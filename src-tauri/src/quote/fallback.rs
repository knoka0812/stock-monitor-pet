use super::*;
use crate::models::{Quote, Stock};

#[derive(Clone)]
pub struct FallbackProvider {
    tencent: TencentProvider,
    sina: SinaProvider,
}

impl Default for FallbackProvider {
    fn default() -> Self {
        Self {
            tencent: TencentProvider::new(),
            sina: SinaProvider::new(),
        }
    }
}

impl FallbackProvider {
    pub fn new() -> Self {
        Self::default()
    }
}

impl QuoteProvider for FallbackProvider {
    fn fetch_quote(&self, symbol: &str) -> Result<Quote> {
        match self.tencent.fetch_quote(symbol) {
            Ok(quote) => Ok(quote),
            Err(tencent_error) => self.sina.fetch_quote(symbol).map_err(|sina_error| {
                QuoteError::Network(format!(
                    "腾讯行情失败: {}; 新浪行情失败: {}",
                    tencent_error, sina_error
                ))
            }),
        }
    }

    fn fetch_quotes(&self, symbols: &[String]) -> Result<Vec<Quote>> {
        match self.tencent.fetch_quotes(symbols) {
            Ok(quotes) => Ok(quotes),
            Err(tencent_error) => self.sina.fetch_quotes(symbols).map_err(|sina_error| {
                QuoteError::Network(format!(
                    "腾讯行情失败: {}; 新浪行情失败: {}",
                    tencent_error, sina_error
                ))
            }),
        }
    }

    fn search(&self, keyword: &str) -> Result<Vec<Stock>> {
        self.tencent.search(keyword)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fallback_provider_constructs() {
        let _provider = FallbackProvider::new();
    }
}
