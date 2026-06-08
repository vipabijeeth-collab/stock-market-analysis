import os
from flask import Flask, render_template, jsonify, request, Response
import csv
import io
from analysis import get_stock_info, get_stock_history, predict_stock_price, compare_stocks

app = Flask(__name__)

# Ensure templates and static folders are set up correctly
# Flask looks in templates/ by default
@app.route('/')
def index():
    """
    Renders the main dashboard HTML interface.
    """
    return render_template('index.html')

@app.route('/api/stock/<ticker>')
def api_stock_info(ticker):
    """
    API endpoint returning profile and financial metrics for a specific ticker symbol.
    """
    info = get_stock_info(ticker)
    if not info:
        return jsonify({"error": f"Failed to retrieve stock metadata for {ticker}. Check symbol spelling."}), 404
    return jsonify(info)

@app.route('/api/history/<ticker>')
def api_stock_history(ticker):
    """
    API endpoint returning historical stock prices and calculated technical indicators.
    Allows passing 'period' and 'interval' as query parameters.
    """
    period = request.args.get('period', '1y')
    interval = request.args.get('interval', None)
    
    history = get_stock_history(ticker, period=period, interval=interval)
    if not history:
        return jsonify({"error": f"Failed to load historical price dataset for {ticker}."}), 404
    return jsonify(history)

@app.route('/api/predict/<ticker>')
def api_stock_predict(ticker):
    """
    API endpoint returning 30-day price forecast and confidence boundaries.
    """
    days = request.args.get('days', 30, type=int)
    prediction = predict_stock_price(ticker, forecast_days=days)
    if not prediction:
        return jsonify({"error": f"Unable to generate price forecast model for {ticker}."}), 404
    return jsonify(prediction)

@app.route('/api/compare')
def api_compare_stocks():
    """
    API endpoint comparing multiple ticker symbols.
    Expects 'tickers' query parameter with comma-separated values (e.g., AAPL,MSFT,TSLA)
    and optional 'period'.
    """
    tickers_str = request.args.get('tickers', '')
    period = request.args.get('period', '1y')
    
    if not tickers_str:
        return jsonify({"error": "Missing 'tickers' query parameter."}), 400
        
    tickers = [t.strip() for t in tickers_str.split(',') if t.strip()]
    if not tickers:
        return jsonify({"error": "No valid tickers provided."}), 400
        
    comparison_data = compare_stocks(tickers, period=period)
    if not comparison_data:
        return jsonify({"error": "Failed to compile comparison data."}), 404
        
    return jsonify(comparison_data)

@app.route('/api/export/<ticker>')
def api_export_csv(ticker):
    """
    Generates and downloads a CSV spreadsheet file containing 
    historical prices, volumes, and calculated technical indicators.
    """
    period = request.args.get('period', '1y')
    ticker = ticker.strip().upper()
    
    history = get_stock_history(ticker, period=period)
    if not history:
        return jsonify({"error": f"Failed to load dataset for export."}), 404
        
    # Write CSV content to memory stream
    output = io.StringIO()
    writer = csv.writer(output)
    
    if history:
        # Determine headers based on keys in the records
        headers = list(history[0].keys())
        # Clean up header display (exclude raw Datetime/Date timestamp objects)
        if 'Date' in headers: headers.remove('Date')
        if 'Datetime' in headers: headers.remove('Datetime')
        
        # Write header row
        writer.writerow(headers)
        
        # Write rows
        for record in history:
            row_data = [record.get(h) for h in headers]
            writer.writerow(row_data)
            
    csv_data = output.getvalue()
    output.close()
    
    # Return as downloadable file attachment
    response = Response(csv_data, mimetype='text/csv')
    response.headers['Content-Disposition'] = f'attachment; filename={ticker}_analysis_{period}.csv'
    return response

if __name__ == '__main__':
    # Run locally on port 5000 in debug mode
    app.run(host='0.0.0.0', port=5000, debug=True)
