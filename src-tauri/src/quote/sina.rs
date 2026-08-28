use super::*;
use crate::models::{Market, Quote, Stock};
use chrono::Utc;
use reqwest::blocking::Client;
use std::time::Duration;

#[derive(Clone)]
pub struct SinaProvider {
    client: Client,
}

impl Default for SinaProvider {
    fn default() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .user_agent("Mozilla/5.0 (compatible; StockPet/0.1)")
            .build()
            .unwrap_or_else(|_| Client::new());
        Self { client }
    }
}

impl SinaProvider {
    pub fn new() -> Self {
        Self::default()
    }
}

pub fn tencent_symbol_to_sina(symbol: &str) -> String {
    if let Some(code) = symbol.strip_prefix("hk") {
        format!("rt_hk{}", code)
    } else if let Some(code) = symbol.strip_prefix("us") {
        format!("gb_{}", code)
    } else {
        symbol.to_string()
    }
}

fn parse_sina_line(symbol_part: &str, value_part: &str) -> Option<Quote> {
    let fields: Vec<&str> = value_part.split(',').collect();
    if fields.len() < 10 {
        return None;
    }

    let (market, name, code) = if symbol_part.starts_with("rt_hk") {
        let name = if fields.len() > 1 && !fields[1].trim().is_empty() {
            fields[1].to_string()
        } else {
            fields[0].to_string()
        };
        let code = symbol_part.trim_start_matches("rt_hk").to_string();
        (Market::HK, name, code)
    } else if symbol_part.starts_with("gb_") {
        let code = symbol_part.trim_start_matches("gb_").to_uppercase();
        (Market::US, fields[0].to_string(), code)
    } else {
        let code = symbol_part
            .trim_start_matches("sh")
            .trim_start_matches("sz")
            .to_string();
        (Market::AShare, fields[0].to_string(), code)
    };

    let (price, prev_close, open, high, low, volume, amount) = match market {
        Market::AShare => {
            let price: f64 = fields[3].parse().ok()?;
            let prev_close: f64 = fields[2].parse().unwrap_or(price);
            let open: f64 = fields[1].parse().unwrap_or(price);
            let high: f64 = fields[4].parse().unwrap_or(price);
            let low: f64 = fields[5].parse().unwrap_or(price);
            let volume: u64 = fields[8].parse().unwrap_or(0);
            let amount: f64 = fields[9].parse().unwrap_or(0.0);
            (price, prev_close, open, high, low, volume, amount)
        }
        Market::HK => {
            let price: f64 = fields[6].parse().ok()?;
            let prev_close: f64 = fields[3].parse().unwrap_or(price);
            let open: f64 = fields[2].parse().unwrap_or(price);
            let high: f64 = fields[4].parse().unwrap_or(price);
            let low: f64 = fields[5].parse().unwrap_or(price);
            let volume: u64 = fields.get(12).and_then(|s| s.parse().ok()).unwrap_or(0);
            let amount: f64 = fields.get(11).and_then(|s| s.parse().ok()).unwrap_or(0.0);
            (price, prev_close, open, high, low, volume, amount)
        }
        Market::US => {
            let price: f64 = fields[1].parse().ok()?;
            let change_pct_text = fields[2].trim().trim_end_matches('%').trim_start_matches('+');
            let change_pct: f64 = change_pct_text.parse().unwrap_or(0.0);
            let change: f64 = fields
                .get(4)
                .and_then(|s| s.parse().ok())
                .unwrap_or(price * change_pct / 100.0);
            let prev_close = if change != 0.0 {
                price - change
            } else {
                price
            };
            let open: f64 = fields.get(5).and_then(|s| s.parse().ok()).unwrap_or(price);
            let high: f64 = fields.get(6).and_then(|s| s.parse().ok()).unwrap_or(price);
            let low: f64 = fields.get(7).and_then(|s| s.parse().ok()).unwrap_or(price);
            let volume: u64 = fields.get(10).and_then(|s| s.parse().ok()).unwrap_or(0);
            let amount = volume as f64 * price;
            (price, prev_close, open, high, low, volume, amount)
        }
    };

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
    })
}

pub fn parse_sina_body(body: &str) -> Result<Vec<Quote>> {
    let mut quotes = Vec::new();

    for line in body.lines() {
        let line = line.trim();
        if !line.starts_with("var hq_str_") {
            continue;
        }
        let eq_pos = line
            .find('=')
            .ok_or_else(|| QuoteError::Parse("缺少 = ".into()))?;
        let symbol_part = line
            ["var hq_str_".len()..eq_pos]
            .trim()
            .to_string();
        let value_part = line[eq_pos + 1..].trim().trim_matches(';').trim_matches('"');
        if value_part.is_empty() {
            continue;
        }
        if let Some(quote) = parse_sina_line(&symbol_part, value_part) {
            quotes.push(quote);
        }
    }

    if quotes.is_empty() {
        return Err(QuoteError::NotFound("新浪行情无有效数据".into()));
    }
    Ok(quotes)
}

impl QuoteProvider for SinaProvider {
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
        let sina_symbols: Vec<String> = symbols
            .iter()
            .map(|s| tencent_symbol_to_sina(s))
            .collect();
        let joined = sina_symbols.join(",");
        let mut last_error = QuoteError::Network("新浪行情请求失败".into());

        for attempt in 0..2 {
            for host in ["https://hq.sinajs.cn", "http://hq.sinajs.cn"] {
                let url = format!("{}/list={}", host, joined);
                let result = self
                    .client
                    .get(&url)
                    .header("Referer", "https://finance.sina.com.cn")
                    .send()
                    .and_then(|resp| resp.bytes());
                match result {
                    Ok(bytes) => {
                        let body = decode_gbk(&bytes);
                        return parse_sina_body(&body);
                    }
                    Err(error) => last_error = QuoteError::Network(error.to_string()),
                }
            }
            if attempt < 1 {
                std::thread::sleep(Duration::from_millis(250));
            }
        }

        Err(last_error)
    }

    fn search(&self, _keyword: &str) -> Result<Vec<Stock>> {
        Err(QuoteError::Network("新浪不提供搜索，由腾讯负责".into()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_symbol_conversion() {
        assert_eq!(tencent_symbol_to_sina("sh600519"), "sh600519");
        assert_eq!(tencent_symbol_to_sina("sz159142"), "sz159142");
        assert_eq!(tencent_symbol_to_sina("hk00700"), "rt_hk00700");
        assert_eq!(tencent_symbol_to_sina("usaapl"), "gb_aapl");
    }

    #[test]
    fn test_parse_ashare_body() {
        let body = r#"var hq_str_sh600519="贵州茅台,1690.000,1680.000,1695.000,1700.000,1685.000,1694.990,1695.000,2528800,4289468992.00,1600,1694.990,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2024-03-15,15:00:00,00";"#;
        let quotes = parse_sina_body(body).unwrap();
        assert_eq!(quotes.len(), 1);
        let quote = &quotes[0];
        assert_eq!(quote.code, "600519");
        assert_eq!(quote.name, "贵州茅台");
        assert_eq!(quote.market, Market::AShare);
        assert_eq!(quote.price, 1695.0);
        assert_eq!(quote.prev_close, 1680.0);
        assert_eq!(quote.open, 1690.0);
        assert_eq!(quote.high, 1700.0);
        assert_eq!(quote.low, 1685.0);
    }

    #[test]
    fn test_parse_hk_body() {
        let body = r#"var hq_str_rt_hk00700="TENCENT,腾讯控股,444.000,447.800,459.800,443.400,455.800,8.000,1.787,455.600,456.000,7659198934.630,16827718,16.578,0.000,675.134,411.000,2026/08/28,14:04:43,30|3,N|Y|Y,0.000|0.000|0.000,0|||0.000|0.000|0.000, |0,Y";"#;
        let quotes = parse_sina_body(body).unwrap();
        assert_eq!(quotes.len(), 1);
        let quote = &quotes[0];
        assert_eq!(quote.code, "00700");
        assert_eq!(quote.name, "腾讯控股");
        assert_eq!(quote.market, Market::HK);
        assert_eq!(quote.price, 455.8);
        assert_eq!(quote.prev_close, 447.8);
        assert_eq!(quote.open, 444.0);
        assert_eq!(quote.high, 459.8);
        assert_eq!(quote.low, 443.4);
        assert_eq!(quote.volume, 16827718);
        assert_eq!(quote.amount, 7659198934.63);
    }

    #[test]
    fn test_parse_us_body() {
        let body = r#"var hq_str_gb_aapl="苹果,314.5800,0.36,2026-08-28 09:42:56,1.1300,310.5450,315.4000,309.4001,344.5700,225.1600,32419233,39308171,4591037323081,8.30,37.900000,0.00,0.00,0.00,0.00,14594180568,63,314.9399,0.11,0.36,Aug 27 08:01PM EDT,Aug 27 04:00PM EDT,313.4500,2440192,1,2026,10164324790.0000,339.2900,293.1896,767602510.0689,314.5800,313.4500";"#;
        let quotes = parse_sina_body(body).unwrap();
        assert_eq!(quotes.len(), 1);
        let quote = &quotes[0];
        assert_eq!(quote.code, "AAPL");
        assert_eq!(quote.name, "苹果");
        assert_eq!(quote.market, Market::US);
        assert_eq!(quote.price, 314.58);
        assert_eq!(quote.open, 310.545);
        assert_eq!(quote.high, 315.4);
        assert_eq!(quote.low, 309.4001);
        assert_eq!(quote.volume, 32419233);
        assert!((quote.change - 1.13).abs() < 1e-6);
        assert!((quote.prev_close - 313.45).abs() < 1e-6);
        assert!(quote.change > 0.0);
    }

    #[test]
    fn test_parse_empty_body() {
        let body = r#"var hq_str_sh600519="";"#;
        assert!(parse_sina_body(body).is_err());
    }
}
