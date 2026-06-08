import datetime
import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.preprocessing import PolynomialFeatures
from sklearn.pipeline import make_pipeline

def get_stock_info(symbol):
    """
    Fetches real-time profile and key metrics of a stock using yfinance.
    """
    try:
        symbol = symbol.strip().upper()
        ticker = yf.Ticker(symbol)
        info = ticker.info
        
        # If ticker.info is empty or invalid, fall back to fast_info
        if not info or 'symbol' not in info:
            fast_info = ticker.fast_info
            if not fast_info or len(fast_info) == 0:
                return None
            info = {
                "symbol": symbol,
                "shortName": symbol,
                "longName": symbol,
                "currentPrice": fast_info.get("last_price", 0.0),
                "marketCap": fast_info.get("market_cap", 0.0),
                "volume": fast_info.get("last_volume", 0.0),
                "open": fast_info.get("open", 0.0),
                "dayHigh": fast_info.get("day_high", 0.0),
                "dayLow": fast_info.get("day_low", 0.0),
                "previousClose": fast_info.get("previous_close", 0.0),
                "fiftyTwoWeekHigh": fast_info.get("year_high", 0.0),
                "fiftyTwoWeekLow": fast_info.get("year_low", 0.0),
            }
        
        # Map values to a cleaner dictionary structure
        clean_info = {
            "symbol": info.get("symbol", symbol),
            "name": info.get("longName") or info.get("shortName") or symbol,
            "price": info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose") or 0.0,
            "change": 0.0,
            "change_percent": 0.0,
            "open": info.get("open") or 0.0,
            "high": info.get("dayHigh") or 0.0,
            "low": info.get("dayLow") or 0.0,
            "prev_close": info.get("previousClose") or 0.0,
            "volume": info.get("volume") or 0.0,
            "avg_volume": info.get("averageVolume") or info.get("averageVolume10days") or 0.0,
            "market_cap": info.get("marketCap") or 0.0,
            "pe_ratio": info.get("trailingPE") or info.get("forwardPE") or None,
            "dividend_yield": (info.get("dividendYield") * 100.0) if info.get("dividendYield") else 0.0,
            "fifty_two_week_high": info.get("fiftyTwoWeekHigh") or 0.0,
            "fifty_two_week_low": info.get("fiftyTwoWeekLow") or 0.0,
            "beta": info.get("beta") or None,
            "sector": info.get("sector", "N/A"),
            "industry": info.get("industry", "N/A"),
            "description": info.get("longBusinessSummary", "No company description available.")
        }
        
        # Calculate daily change if possible
        if clean_info["price"] and clean_info["prev_close"]:
            clean_info["change"] = clean_info["price"] - clean_info["prev_close"]
            clean_info["change_percent"] = (clean_info["change"] / clean_info["prev_close"]) * 100.0
            
        return clean_info
    except Exception as e:
        print(f"Error fetching stock info for {symbol}: {e}")
        return None

def calculate_indicators(df):
    """
    Appends technical analysis indicators (SMAs, EMA, Bollinger Bands, RSI, MACD) to the DataFrame.
    """
    close = df['Close']
    
    # 1. Simple Moving Averages (SMA)
    df['SMA_20'] = close.rolling(window=20).mean()
    df['SMA_50'] = close.rolling(window=50).mean()
    df['SMA_200'] = close.rolling(window=200).mean()
    
    # 2. Exponential Moving Average (EMA)
    df['EMA_20'] = close.ewm(span=20, adjust=False).mean()
    
    # 3. Bollinger Bands (20-period SMA + 2*std)
    sma_20 = close.rolling(window=20).mean()
    std_20 = close.rolling(window=20).std()
    df['BB_Middle'] = sma_20
    df['BB_Upper'] = sma_20 + (std_20 * 2)
    df['BB_Lower'] = sma_20 - (std_20 * 2)
    
    # 4. Relative Strength Index (RSI - 14-period)
    delta = close.diff()
    gain = (delta.where(delta > 0, 0.0)).ewm(alpha=1/14, adjust=False).mean()
    loss = (-delta.where(delta < 0, 0.0)).ewm(alpha=1/14, adjust=False).mean()
    rs = gain / np.where(loss == 0.0, 1e-9, loss)
    df['RSI'] = 100.0 - (100.0 / (1.0 + rs))
    
    # 5. MACD (12, 26, 9)
    ema_12 = close.ewm(span=12, adjust=False).mean()
    ema_26 = close.ewm(span=26, adjust=False).mean()
    df['MACD'] = ema_12 - ema_26
    df['MACD_Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()
    df['MACD_Hist'] = df['MACD'] - df['MACD_Signal']
    
    return df

def get_stock_history(symbol, period='1y', interval=None):
    """
    Retrieves historical price chart data and calculates indicators.
    """
    period_intervals = {
        '1d': '5m',
        '5d': '15m',
        '1m': '1d',
        '3m': '1d',
        '6m': '1d',
        '1y': '1d',
        '5y': '1d',
        'max': '1d'
    }
    
    symbol = symbol.strip().upper()
    if not interval:
        interval = period_intervals.get(period, '1d')
        
    # Map frontend period codes to yfinance periods (e.g. 1m -> 1mo)
    yf_period = period
    if period == '1m':
        yf_period = '1mo'
    elif period == '3m':
        yf_period = '3mo'
    elif period == '6m':
        yf_period = '6mo'
        
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=yf_period, interval=interval)
        
        if df.empty:
            return None
            
        # Apply technical indicator math
        df = calculate_indicators(df)
        
        # Reset index to pull date column out
        df = df.reset_index()
        
        # Format dates nicely for Plotly.js consumption
        date_col = 'Date' if 'Date' in df.columns else 'Datetime'
        if date_col not in df.columns:
            # Sometime it's index named Date/Datetime but reset_index renamed it
            # We look for index name
            date_col = df.columns[0]
            
        if interval in ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h']:
            df['Formatted_Date'] = df[date_col].dt.strftime('%Y-%m-%d %H:%M')
        else:
            df['Formatted_Date'] = df[date_col].dt.strftime('%Y-%m-%d')
            
        # Convert to records list of dictionaries
        records = df.to_dict(orient='records')
        
        # Replace NaN/inf with None for JSON serialization compatibility
        for record in records:
            for key, val in record.items():
                if isinstance(val, float) and (np.isnan(val) or np.isinf(val)):
                    record[key] = None
        
        return records
    except Exception as e:
        print(f"Error fetching stock history for {symbol}: {e}")
        return None

def predict_stock_price(symbol, forecast_days=30):
    """
    Uses Ridge Regression with polynomial features to forecast the stock price
    for the next 30 business days, appending confidence interval bounds.
    """
    symbol = symbol.strip().upper()
    try:
        # Fetch 2 years of daily data to train our trend model
        ticker = yf.Ticker(symbol)
        df = ticker.history(period='2y', interval='1d')
        if df.empty or len(df) < 30:
            return None
            
        df = df.reset_index()
        date_col = 'Date' if 'Date' in df.columns else 'Datetime'
        if date_col not in df.columns:
            date_col = df.columns[0]
            
        df['Date_Num'] = range(len(df))
        
        # Fit polynomial regression (degree=2 for quadratic curves, avoiding runaway extrapolation)
        X = df[['Date_Num']].values
        y = df['Close'].values
        
        # Ridge regression keeps model coefficients regularized
        model = make_pipeline(PolynomialFeatures(degree=2), Ridge(alpha=10.0))
        model.fit(X, y)
        
        # Compute historical residuals to estimate volatility/error
        fitted_values = model.predict(X)
        residuals = y - fitted_values
        std_error = np.std(residuals)
        
        # Project future steps
        last_num = df['Date_Num'].iloc[-1]
        last_date = df[date_col].iloc[-1]
        
        future_nums = np.array([[last_num + i] for i in range(1, forecast_days + 1)])
        future_preds = model.predict(future_nums)
        
        # Compute dates for future business days (skipping weekends)
        future_dates = []
        curr_date = last_date
        while len(future_dates) < forecast_days:
            curr_date += datetime.timedelta(days=1)
            # 5 is Saturday, 6 is Sunday
            if curr_date.weekday() < 5:
                future_dates.append(curr_date.strftime('%Y-%m-%d'))
                
        # Calculate uncertainty boundaries that expand over time (simulating standard volatility)
        upper_bound = []
        lower_bound = []
        for i, val in enumerate(future_preds):
            time_step = i + 1
            # Uncertainty expands proportionally to the square root of time
            interval = 1.96 * std_error * np.sqrt(1 + 0.1 * time_step)
            upper_bound.append(float(val + interval))
            lower_bound.append(float(max(0.0, val - interval)))
            
        # Determine trend signal
        pct_change = ((future_preds[-1] - y[-1]) / y[-1]) * 100.0
        if pct_change > 4.0:
            signal = "Bullish (Buy/Hold)"
        elif pct_change < -4.0:
            signal = "Bearish (Sell/Short)"
        else:
            signal = "Neutral (Hold)"
            
        # Format recent history for baseline visual
        historical_subset = df[[date_col, 'Close']].tail(90).copy()
        historical_subset['Date_Formatted'] = historical_subset[date_col].dt.strftime('%Y-%m-%d')
        
        result = {
            "symbol": symbol,
            "current_price": float(y[-1]),
            "projected_price": float(future_preds[-1]),
            "percent_change": float(pct_change),
            "signal": signal,
            "historical": [
                {"date": row['Date_Formatted'], "close": float(row['Close'])}
                for _, row in historical_subset.iterrows()
            ],
            "forecast": [
                {
                    "date": future_dates[i],
                    "predicted": float(future_preds[i]),
                    "upper": float(upper_bound[i]),
                    "lower": float(lower_bound[i])
                }
                for i in range(forecast_days)
            ]
        }
        return result
    except Exception as e:
        print(f"Error predicting stock price for {symbol}: {e}")
        return None

def compare_stocks(symbols, period='1y'):
    """
    Compares normalized historical returns (percentage change) for multiple stock symbols.
    """
    data = {}
    
    # Map frontend period codes to yfinance periods (e.g. 1m -> 1mo)
    yf_period = period
    if period == '1m':
        yf_period = '1mo'
    elif period == '3m':
        yf_period = '3mo'
    elif period == '6m':
        yf_period = '6mo'
        
    try:
        for sym in symbols:
            sym = sym.strip().upper()
            if not sym:
                continue
            ticker = yf.Ticker(sym)
            df = ticker.history(period=yf_period, interval='1d')
            if df.empty:
                continue
                
            initial_price = df['Close'].iloc[0]
            df['Percent_Return'] = ((df['Close'] - initial_price) / initial_price) * 100.0
            
            df = df.reset_index()
            date_col = 'Date' if 'Date' in df.columns else 'Datetime'
            if date_col not in df.columns:
                date_col = df.columns[0]
                
            df['Formatted_Date'] = df[date_col].dt.strftime('%Y-%m-%d')
            
            # Format outputs via dictionaries to prevent float NaN serialization
            records = df.to_dict(orient='records')
            for record in records:
                for key, val in record.items():
                    if isinstance(val, float) and (np.isnan(val) or np.isinf(val)):
                        record[key] = None
                        
            data[sym] = [
                {
                    "date": row['Formatted_Date'],
                    "percent_return": row['Percent_Return'],
                    "close": row['Close']
                }
                for row in records
            ]
            
        return data
    except Exception as e:
        print(f"Error comparing stocks: {e}")
        return None
