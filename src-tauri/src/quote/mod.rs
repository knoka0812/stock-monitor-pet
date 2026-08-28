use crate::models::{Market, Quote, Stock};
use encoding_rs::GBK;
use thiserror::Error;

pub mod tencent;
pub mod sina;
pub mod fallback;

pub use tencent::TencentProvider;
pub use sina::SinaProvider;
pub use fallback::FallbackProvider;

#[derive(Debug, Error)]
pub enum QuoteError {
    #[error("网络请求失败: {0}")]
    Network(String),
    #[error("解析行情数据失败: {0}")]
    Parse(String),
    #[error("未找到股票: {0}")]
    NotFound(String),
}

pub type Result<T> = std::result::Result<T, QuoteError>;

pub trait QuoteProvider: Send + Sync {
    fn fetch_quote(&self, symbol: &str) -> Result<Quote>;
    fn fetch_quotes(&self, symbols: &[String]) -> Result<Vec<Quote>>;
    fn search(&self, keyword: &str) -> Result<Vec<Stock>>;
}

pub fn detect_market_and_symbol(code: &str) -> Option<(Market, String)> {
    let code = code.trim().to_uppercase();
    if code.is_empty() {
        return None;
    }

    // 国际黄金（XAUUSD / 现货黄金）
    match code.as_str() {
        "XAUUSD" | "XAU" | "GOLD" | "黄金" | "伦敦金" => {
            return Some((Market::Gold, "hf_XAU".to_string()));
        }
        _ => {}
    }

    // 腾讯格式前缀
    if let Some(rest) = code.strip_prefix("SH") {
        return Some((Market::AShare, format!("sh{}", rest.to_lowercase())));
    }
    if let Some(rest) = code.strip_prefix("SZ") {
        return Some((Market::AShare, format!("sz{}", rest.to_lowercase())));
    }
    if let Some(rest) = code.strip_prefix("HK") {
        return Some((Market::HK, format!("hk{}", rest.to_lowercase())));
    }

    // 纯数字猜测
    if code.chars().all(|c| c.is_ascii_digit()) {
        let digits = code.as_str();
        // A 股：6 位
        if digits.len() == 6 {
            let prefix = &digits[..1];
            // 6/5/9 开头 = 上交所（含 51/56/58 系列 ETF）；0/1/2/3 开头 = 深交所（含 15/16/18 系列 ETF）
            match prefix {
                "5" | "6" | "9" => return Some((Market::AShare, format!("sh{}", digits))),
                "0" | "1" | "2" | "3" => return Some((Market::AShare, format!("sz{}", digits))),
                _ => {}
            }
        }
        // 港股：4-5 位数字
        if digits.len() >= 3 && digits.len() <= 5 {
            let padded = format!("hk{:0>5}", digits);
            return Some((Market::HK, padded));
        }
    }

    // 字母开头 = 美股（先用 QQ 美股接口格式 us）
    if code.chars().next().map_or(false, |c| c.is_ascii_alphabetic()) {
        return Some((Market::US, format!("us{}", code.to_lowercase())));
    }

    None
}

fn decode_gbk(data: &[u8]) -> String {
    let (cow, _, _) = GBK.decode(data);
    cow.into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_shanghai_stock() {
        let (market, symbol) = detect_market_and_symbol("600519").unwrap();
        assert_eq!(market, Market::AShare);
        assert_eq!(symbol, "sh600519");
    }

    #[test]
    fn test_detect_shenzhen_stock() {
        let (market, symbol) = detect_market_and_symbol("000001").unwrap();
        assert_eq!(market, Market::AShare);
        assert_eq!(symbol, "sz000001");
    }

    #[test]
    fn test_detect_chinext() {
        let (market, symbol) = detect_market_and_symbol("300750").unwrap();
        assert_eq!(market, Market::AShare);
        assert_eq!(symbol, "sz300750");
    }

    #[test]
    fn test_detect_shenzhen_etf() {
        let (market, symbol) = detect_market_and_symbol("159142").unwrap();
        assert_eq!(market, Market::AShare);
        assert_eq!(symbol, "sz159142");
    }

    #[test]
    fn test_detect_shanghai_etf() {
        let (market, symbol) = detect_market_and_symbol("510300").unwrap();
        assert_eq!(market, Market::AShare);
        assert_eq!(symbol, "sh510300");
    }

    #[test]
    fn test_detect_hk_stock() {
        let (market, symbol) = detect_market_and_symbol("00700").unwrap();
        assert_eq!(market, Market::HK);
        assert_eq!(symbol, "hk00700");
    }

    #[test]
    fn test_detect_hk_stock_short() {
        let (market, symbol) = detect_market_and_symbol("700").unwrap();
        assert_eq!(market, Market::HK);
        assert_eq!(symbol, "hk00700");
    }

    #[test]
    fn test_detect_us_stock() {
        let (market, symbol) = detect_market_and_symbol("AAPL").unwrap();
        assert_eq!(market, Market::US);
        assert_eq!(symbol, "usaapl");
    }

    #[test]
    fn test_with_prefix_sh() {
        let (market, symbol) = detect_market_and_symbol("SH600519").unwrap();
        assert_eq!(market, Market::AShare);
        assert_eq!(symbol, "sh600519");
    }

    #[test]
    fn test_empty_code() {
        assert!(detect_market_and_symbol("").is_none());
    }

    #[test]
    fn test_detect_gold_keywords() {
        for keyword in ["XAUUSD", "xauusd", "XAU", "GOLD", "黄金", "伦敦金"] {
            let (market, symbol) = detect_market_and_symbol(keyword).unwrap();
            assert_eq!(market, Market::Gold);
            assert_eq!(symbol, "hf_XAU");
        }
    }
}
