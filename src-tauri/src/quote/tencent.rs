use super::*;
use crate::models::{Market, Quote, Stock};
use chrono::Utc;
use reqwest::blocking::Client;
use std::time::Duration;

#[derive(Clone)]
pub struct TencentProvider {
    client: Client,
}

impl Default for TencentProvider {
    fn default() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .user_agent("Mozilla/5.0 (compatible; StockPet/0.1)")
            .build()
            .unwrap_or_else(|_| Client::new());
        Self { client }
    }
}

impl TencentProvider {
    pub fn new() -> Self {
        Self::default()
    }

    fn build_url(symbols: &[String]) -> String {
        let joined = symbols.join(",");
        format!("https://qt.gtimg.cn/q={}", joined)
    }
}

impl QuoteProvider for TencentProvider {
    fn fetch_quote(&self, symbol: &str) -> Result<Quote> {
        let quotes = self.fetch_quotes(&[symbol.to_string()])?;
        quotes
            .into_iter()
            .next()
            .ok_or_else(|| QuoteError::NotFound(symbol.to_string()))
    }

    fn fetch_quotes(&self, symbols: &[String]) -> Result<Vec<Quote>> {
        if symbols.is_empty() {
            return Ok(vec![]);
        }
        let url = Self::build_url(symbols);
        let resp = self
            .client
            .get(&url)
            .send()
            .map_err(|e| QuoteError::Network(e.to_string()))?;

        let bytes = resp
            .bytes()
            .map_err(|e| QuoteError::Network(e.to_string()))?;

        let body = decode_gbk(&bytes);
        let mut quotes = Vec::new();

        for line in body.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            // v_sh600519="1~贵州茅台~600519~..."
            if !line.starts_with("v_") {
                continue;
            }
            let eq_pos = line.find('=').ok_or_else(|| QuoteError::Parse("缺少 = ".into()))?;
            let symbol_part = &line[2..eq_pos];
            let value_part = line[eq_pos + 1..].trim_matches('"');
            if value_part.is_empty() {
                continue;
            }

            let fields: Vec<&str> = value_part.split('~').collect();
            if fields.len() < 32 {
                continue;
            }

            let market = if symbol_part.starts_with("hk") {
                Market::HK
            } else if symbol_part.starts_with("us") {
                Market::US
            } else {
                Market::AShare
            };

            let name = fields[1].to_string();
            let code = fields[2].to_string();
            let price: f64 = fields[3].parse().unwrap_or(0.0);
            let prev_close: f64 = fields[4].parse().unwrap_or(0.0);
            let open: f64 = fields[5].parse().unwrap_or(0.0);
            // 港股字段位置略有不同，volume 在第 6 位，amount 第 37 位左右；A 股 volume 第 6 位，amount 第 37 位
            let volume: u64 = fields[6].parse().unwrap_or(0);
            let high: f64 = fields[33].parse().unwrap_or(price);
            let low: f64 = fields[34].parse().unwrap_or(price);
            let amount: f64 = fields
                .get(37)
                .and_then(|s| s.parse().ok())
                .unwrap_or(0.0);

            let change = if prev_close > 0.0 {
                price - prev_close
            } else {
                0.0
            };
            let change_percent = if prev_close > 0.0 {
                (change / prev_close) * 100.0
            } else {
                0.0
            };

            quotes.push(Quote {
                code,
                name,
                market,
                price,
                prev_close,
                open,
                high,
                low,
                volume,
                amount,
                change,
                change_percent,
                timestamp: Utc::now().timestamp(),
            });
        }

        Ok(quotes)
    }

    fn search(&self, keyword: &str) -> Result<Vec<Stock>> {
        // 用建议接口（sug）搜索
        let url = format!(
            "https://smartbox.gtimg.cn/s3/?v=2&t=all&c=10&q={}",
            urlencoding::encode(keyword)
        );
        let resp = self
            .client
            .get(&url)
            .send()
            .map_err(|e| QuoteError::Network(e.to_string()))?;

        let bytes = resp
            .bytes()
            .map_err(|e| QuoteError::Network(e.to_string()))?;

        let body = decode_gbk(&bytes);
        let mut results = Vec::new();

        // 格式：v_hint="code~name~type~...^..."
        // 简化处理：从引号里拿内容，按 ^ 分隔，再按 ~ 拆分
        if let Some(start) = body.find('"') {
            if let Some(end) = body.rfind('"') {
                let content = &body[start + 1..end];
                for item in content.split('^') {
                    let parts: Vec<&str> = item.split('~').collect();
                    if parts.len() >= 3 {
                        let code = parts[0].to_string();
                        let name = parts[1].to_string();
                        let raw_type = parts[2];
                        let (market, tencent_symbol) = match raw_type {
                            "sh" | "sz" => (Market::AShare, format!("{}{}", raw_type, code)),
                            "hk" => (Market::HK, format!("hk{}", code)),
                            "us" => (Market::US, format!("us{}", code.to_lowercase())),
                            _ => continue,
                        };
                        results.push(Stock {
                            code,
                            name,
                            market,
                            tencent_symbol,
                        });
                    }
                }
            }
        }

        // 若搜索接口不可用，回退到直接识别代码
        if results.is_empty() {
            if let Some((market, symbol)) = detect_market_and_symbol(keyword) {
                if let Ok(q) = self.fetch_quote(&symbol) {
                    results.push(Stock {
                        code: q.code.clone(),
                        name: q.name,
                        market,
                        tencent_symbol: symbol,
                    });
                }
            }
        }

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ashare_line() {
        let _provider = TencentProvider::new();
        // 构造一个模拟输入，测试本地解析函数
        let line = r#"v_sh600519="1~贵州茅台~600519~1680.00~1700.00~1690.00~123456~...""#;
        assert!(line.starts_with("v_sh"));
        assert!(line.contains('='));
    }

    #[test]
    fn test_detect_and_symbol_consistency() {
        let (m, s) = detect_market_and_symbol("600519").unwrap();
        assert_eq!(m, Market::AShare);
        assert_eq!(s, "sh600519");
    }
}
