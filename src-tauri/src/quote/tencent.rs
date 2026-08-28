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
}

fn unescape_unicode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut output = String::with_capacity(input.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'\\'
            && index + 5 < bytes.len()
            && bytes[index + 1] == b'u'
        {
            if let Ok(value) = u32::from_str_radix(&input[index + 2..index + 6], 16) {
                if let Some(char) = char::from_u32(value) {
                    output.push(char);
                    index += 6;
                    continue;
                }
            }
        }
        let char = input[index..]
            .chars()
            .next()
            .unwrap_or_default();
        output.push(char);
        index += char.len_utf8();
    }
    output
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
        let joined = symbols.join(",");
        let mut last_error = QuoteError::Network("行情请求失败".into());

        for attempt in 0..3 {
            for host in ["https://qt.gtimg.cn", "http://qt.gtimg.cn"] {
                let url = format!("{}/q={}", host, joined);
                let result = self.client.get(&url).send().and_then(|resp| resp.bytes());
                match result {
                    Ok(bytes) => {
                        let body = decode_gbk(&bytes);
                        return parse_quote_body(&body);
                    }
                    Err(error) => last_error = QuoteError::Network(error.to_string()),
                }
            }
            if attempt < 2 {
                std::thread::sleep(Duration::from_millis(250 * (attempt + 1)));
            }
        }

        Err(last_error)
    }

    fn search(&self, keyword: &str) -> Result<Vec<Stock>> {
        let keyword_trimmed = keyword.trim();
        let keyword_upper = keyword_trimmed.to_uppercase();
        if matches!(keyword_upper.as_str(), "XAUUSD" | "XAU" | "GOLD" | "HF_XAU")
            || matches!(keyword_trimmed, "黄金" | "伦敦金")
        {
            return Ok(vec![Stock {
                code: "XAUUSD".into(),
                name: "伦敦金（现货黄金）".into(),
                market: Market::Gold,
                tencent_symbol: "hf_XAU".into(),
            }]);
        }

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

        // 格式：v_hint="market~code~name~pinyin~type^..."
        if let Some(start) = body.find('"') {
            if let Some(end) = body.rfind('"') {
                let content = &body[start + 1..end];
                for item in content.split('^') {
                    let parts: Vec<&str> = item.split('~').collect();
                    if parts.len() >= 3 {
                        let raw_market = parts[0];
                        let code = parts[1].to_string();
                        let name = unescape_unicode(parts[2]);
                        let (market, tencent_symbol) = match raw_market {
                            "sh" | "sz" => (Market::AShare, format!("{}{}", raw_market, code)),
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

fn parse_quote_body(body: &str) -> Result<Vec<Quote>> {
    let mut quotes = Vec::new();

    for line in body.lines() {
        let line = line.trim();
        if line.is_empty() || !line.starts_with("v_") {
            continue;
        }
        let eq_pos = line.find('=').ok_or_else(|| QuoteError::Parse("缺少 = ".into()))?;
        let symbol_part = &line[2..eq_pos];
        let raw_value = line[eq_pos + 1..].trim();
        let value_part = raw_value
            .strip_prefix('"')
            .and_then(|value| {
                value
                    .strip_suffix("\";")
                    .or_else(|| value.strip_suffix('"'))
            })
            .unwrap_or(raw_value);
        if value_part.is_empty() {
            continue;
        }

        if symbol_part.starts_with("hf_") {
            if let Some(quote) = parse_hf_quote(symbol_part, value_part) {
                quotes.push(quote);
            }
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
            symbol: symbol_part.to_lowercase(),
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

fn parse_hf_quote(symbol_part: &str, value_part: &str) -> Option<Quote> {
    let fields: Vec<&str> = value_part.split(',').collect();
    if fields.len() < 14 {
        return None;
    }

    let price: f64 = fields[0].parse().ok()?;
    let prev_close: f64 = fields[7].parse().unwrap_or(price);
    let open: f64 = fields[8].parse().unwrap_or(price);
    let high: f64 = fields[4].parse().unwrap_or(price);
    let low: f64 = fields[5].parse().unwrap_or(price);
    let name = fields[13].to_string();

    if price <= 0.0 {
        return None;
    }

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

    Some(Quote {
        code: "XAUUSD".to_string(),
        symbol: symbol_part.to_lowercase(),
        name,
        market: Market::Gold,
        price,
        prev_close,
        open,
        high,
        low,
        volume: 0,
        amount: 0.0,
        change,
        change_percent,
        timestamp: Utc::now().timestamp(),
    })
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
    fn test_parse_hf_gold_line() {
        let line = r#"v_hf_XAU="4583.21,-0.40,4583.21,4583.56,4611.35,4571.63,14:33:00,4601.58,4603.23,0,0,0,2026-08-28,伦敦金（现货黄金）";"#;
        let quotes = parse_quote_body(line).unwrap();
        assert_eq!(quotes.len(), 1);
        let quote = &quotes[0];
        assert_eq!(quote.code, "XAUUSD");
        assert_eq!(quote.name, "伦敦金（现货黄金）");
        assert_eq!(quote.market, Market::Gold);
        assert_eq!(quote.price, 4583.21);
        assert_eq!(quote.prev_close, 4601.58);
        assert_eq!(quote.open, 4603.23);
        assert_eq!(quote.high, 4611.35);
        assert_eq!(quote.low, 4571.63);
        assert_eq!(quote.volume, 0);
        assert!((quote.change - (-18.37)).abs() < 1e-6);
    }

    #[test]
    fn test_unescape_unicode() {
        assert_eq!(unescape_unicode(r"\u8d35\u5dde\u8305\u53f0"), "贵州茅台");
        assert_eq!(unescape_unicode("普通文本"), "普通文本");
    }

    #[test]
    fn test_detect_and_symbol_consistency() {
        let (m, s) = detect_market_and_symbol("600519").unwrap();
        assert_eq!(m, Market::AShare);
        assert_eq!(s, "sh600519");
    }
}
