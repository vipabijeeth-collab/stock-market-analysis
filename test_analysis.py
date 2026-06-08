import unittest
import numpy as np
from analysis import get_stock_info, get_stock_history, predict_stock_price, compare_stocks

class TestStockMarketAnalysis(unittest.TestCase):
    
    def setUp(self):
        # We will use Apple (AAPL) as the reference ticker for testing
        self.ticker = "AAPL"
        
    def test_get_stock_info_valid(self):
        """Test retrieving metadata for a valid stock ticker."""
        info = get_stock_info(self.ticker)
        self.assertIsNotNone(info)
        self.assertEqual(info["symbol"], self.ticker)
        self.assertIn("name", info)
        self.assertIn("price", info)
        self.assertIn("market_cap", info)
        self.assertIn("sector", info)
        self.assertGreater(info["price"], 0.0)
        
    def test_get_stock_info_invalid(self):
        """Test that get_stock_info returns None for an invalid symbol."""
        info = get_stock_info("XYZXYZXYZ999")
        self.assertIsNone(info)
        
    def test_get_stock_history_valid(self):
        """Test fetching historical prices and technical indicator calculations."""
        history = get_stock_history(self.ticker, period="1y")
        self.assertIsNotNone(history)
        self.assertGreater(len(history), 50)  # Should have 250+ trading days in a year
        
        # Test first record to see columns
        first_record = history[-1]
        self.assertIn("Close", first_record)
        self.assertIn("Volume", first_record)
        self.assertIn("Formatted_Date", first_record)
        
        # Test indicators (last records should have indicators calculated)
        self.assertIn("SMA_20", first_record)
        self.assertIn("SMA_50", first_record)
        self.assertIn("SMA_200", first_record)
        self.assertIn("EMA_20", first_record)
        self.assertIn("RSI", first_record)
        self.assertIn("MACD", first_record)
        self.assertIn("BB_Upper", first_record)
        
        # Ensure moving average is float and not NaN on recent periods
        self.assertIsInstance(first_record["SMA_20"], float)
        self.assertIsInstance(first_record["RSI"], float)
        
    def test_predict_stock_price(self):
        """Test the Machine Learning forecasting engine output structure."""
        forecast_days = 30
        prediction = predict_stock_price(self.ticker, forecast_days=forecast_days)
        
        self.assertIsNotNone(prediction)
        self.assertEqual(prediction["symbol"], self.ticker)
        self.assertIn("current_price", prediction)
        self.assertIn("projected_price", prediction)
        self.assertIn("signal", prediction)
        
        # Test forecast records length
        self.assertEqual(len(prediction["forecast"]), forecast_days)
        
        # Check first forecast element has predicted price and confidence limits
        first_forecast = prediction["forecast"][0]
        self.assertIn("date", first_forecast)
        self.assertIn("predicted", first_forecast)
        self.assertIn("upper", first_forecast)
        self.assertIn("lower", first_forecast)
        
        # Check that boundaries are expanding (lower gets lower, upper gets higher relative to prediction)
        f_start = prediction["forecast"][0]
        f_end = prediction["forecast"][-1]
        
        start_spread = f_start["upper"] - f_start["lower"]
        end_spread = f_end["upper"] - f_end["lower"]
        
        # Uncertainty should expand over time
        self.assertGreater(end_spread, start_spread)
        
    def test_compare_stocks(self):
        """Test comparing returns for multiple symbols."""
        symbols = ["AAPL", "MSFT", "GOOGL"]
        comp = compare_stocks(symbols, period="1m")
        
        self.assertIsNotNone(comp)
        for sym in symbols:
            self.assertIn(sym, comp)
            self.assertGreater(len(comp[sym]), 10)
            
            # Check percentage return properties
            first_ret = comp[sym][0]["percent_return"]
            # Start of timeframe percentage return should be 0.0%
            self.assertAlmostEqual(first_ret, 0.0, places=2)

if __name__ == '__main__':
    unittest.main()
