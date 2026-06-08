# Stock Market Data Analysis Dashboard

A professional-grade, interactive web application built with **Python (Flask)**, **Pandas**, **scikit-learn**, and **Plotly.js** for real-time stock market data retrieval, technical analysis, and forecasting.

This application is designed to be fully responsive, lightweight, and deployable to free cloud platforms so that **anyone on the web can use it** without any local installation.

---

## System Architecture

```mermaid
graph TD
    User[Web Browser Client] <-->|HTTP / JSON APIs| Flask[Flask Web Server (app.py)]
    Flask <-->|Invokes Operations| Engine[Analysis Engine (analysis.py)]
    Engine <-->|Calculates Indicators| Stats[Pandas / NumPy / scikit-learn]
    Engine <-->|Fetches Market Data| YFinance[Yahoo Finance API]
    User <-->|Renders Visualizations| Plotly[Plotly.js Interactive Charts]
```

---

## Core Features

1. **Interactive Search & Autocomplete**: Quickly lookup stock tickers, indices (S&P 500, Nasdaq, Dow Jones), commodities (Gold, Crude Oil), and cryptocurrencies (Bitcoin, Ethereum).
2. **Interactive Charting (Plotly.js)**:
   - Toggle between **Candlestick** and **Line chart** styles.
   - Choose time periods: `1D`, `5D`, `1M`, `3M`, `6M`, `1Y`, `5Y`, and `MAX`.
   - Toggle overlays: Simple Moving Averages (`SMA 20`, `SMA 50`, `SMA 200`) and `Bollinger Bands`.
   - Separate panels for **Volume**, **RSI**, and **MACD** with tooltips and zoom synchronization.
3. **Key Financial Metrics**: View real-time metadata including Market Cap, P/E Ratio, Dividend Yield, volume figures, 52-week pricing spread, and business summary.
4. **AI-powered Price Forecasting**:
   - Forecasts prices for the next **30 business days** using a Polynomial Ridge Regression model.
   - Highlights the trend direction with colored indicator pills (`Bullish`, `Bearish`, `Neutral`).
   - Renders forecast curves with shaded **95% Confidence Intervals** representing volatility projections.
5. **Stock Return Comparison**: Normalize price datasets to compare the return percentages of up to 5 symbols side-by-side.
6. **Data & Report Exporting**:
   - Download historical records containing raw prices and calculated technical indicators as a CSV spreadsheet.
   - Print a clean, formatted report directly to PDF (`Ctrl + P`).

---

## Technical Indicators & Mathematical Modeling

The technical indicators displayed in the application are calculated mathematically on the backend:

*   **Simple Moving Average (SMA)**:
    $$\text{SMA}_k(t) = \frac{1}{k}\sum_{i=0}^{k-1} \text{Close}(t-i)$$
*   **Exponential Moving Average (EMA)**:
    $$\text{EMA}_k(t) = \alpha \cdot \text{Close}(t) + (1 - \alpha) \cdot \text{EMA}_k(t-1)$$
    where $\alpha = \frac{2}{k+1}$
*   **Relative Strength Index (RSI)**: Measures momentum on a scale of 0 to 100.
    $$\text{RSI} = 100 - \frac{100}{1 + \text{RS}}$$
    where $\text{RS} = \frac{\text{EMA}_{14}(\text{Gain})}{\text{EMA}_{14}(\text{Loss})}$
*   **Bollinger Bands (BB)**: Evaluates asset price volatility.
    $$\text{BB\_Middle} = \text{SMA}_{20}$$
    $$\text{BB\_Upper/Lower} = \text{SMA}_{20} \pm 2 \times \sigma_{20}$$
    where $\sigma_{20}$ is the 20-day standard deviation of the Close price.
*   **MACD (Moving Average Convergence Divergence)**:
    $$\text{MACD} = \text{EMA}_{12}(\text{Close}) - \text{EMA}_{26}(\text{Close})$$
    $$\text{Signal Line} = \text{EMA}_{9}(\text{MACD})$$
    $$\text{Histogram} = \text{MACD} - \text{Signal Line}$$

### Price Forecasting Model
The forecasting engine fits a **Ridge Regression** model with quadratic polynomial features ($t$, $t^2$) on $2$ years of daily trading data:
$$y(t) = w_0 + w_1 t + w_2 t^2 + \epsilon$$
Confidence intervals expand over time, modeling price volatility expanding proportionally to the square root of time:
$$\hat{y}(t_{\text{future}}) \pm z \cdot \sigma_{\text{residuals}} \cdot \sqrt{1 + 0.1 \times \Delta t}$$
where $z = 1.96$ for a 95% confidence boundary.

---

## Local Setup & Run Instructions

To run the application locally on your computer:

### Prerequisites
Make sure you have **Python 3.8+** installed.

### 1. Install Dependencies
Navigate into the project directory and install the required modules:
```bash
pip install -r requirements.txt
```

### 2. Run the Application
Start the Flask development server:
```bash
python app.py
```

### 3. Open in Browser
Open your browser and navigate to:
```
http://127.0.0.1:5000
```

---

## How to Make It Public (Cloud Deployment)

To host this project on the web so that **everybody can access it from their browsers for free**, follow these deployment instructions:

### Step 1: Upload Your Code to GitHub
1. Create a free account at [github.com](https://github.com).
2. Create a new repository named `stock-market-analysis`.
3. Push your project files (`app.py`, `analysis.py`, `requirements.txt`, `templates/`, `static/`) to your new GitHub repository.

### Option A: Deploy to Vercel (Free Serverless Hosting - Recommended)
Vercel is an extremely fast cloud platform that supports deploying Python Flask web apps natively using Serverless Functions.

1. Ensure the `vercel.json` configuration file is in your project root folder (it has been created for you).
2. Go to [vercel.com](https://vercel.com) and log in or sign up.
3. Click the **"Add New"** button in your dashboard, select **"Project"**, and connect/import your GitHub repository.
4. Expand the **"Environment Variables"** setting panel and add:
   *   **Key**: `PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION`
   *   **Value**: `python`
   *(This environment variable bypasses Python C-API metaclass conflicts on Vercel's serverless containers).*
5. Click **"Deploy"**. 

Vercel will install the python wheels and deploy the project. Within 2 minutes, it will generate a public, production-ready URL (e.g. `https://stock-analysis.vercel.app`) that you can share with everyone!

### Option B: Deploy to Render (Free Web Service Hosting)
Render is a developer-friendly cloud platform that allows hosting Flask web applications as persistent services for free:

1. Go to [render.com](https://render.com) and sign up for a free account.
2. Click the **"New"** button in the dashboard and select **"Web Service"**.
3. Connect your GitHub account and select your repository.
4. Configure the Web Service settings:
    *   **Name**: `stock-analysis-dashboard` (or any unique name)
    *   **Environment**: `Python`
    *   **Branch**: `main`
    *   **Build Command**: `pip install -r requirements.txt`
    *   **Start Command**: `gunicorn app:app`
5. Scroll down and click **"Advanced"** to add an **Environment Variable**:
    *   **Key**: `PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION`
    *   **Value**: `python`
6. Click **"Create Web Service"**.

Once the build completes, a public HTTPS link (e.g. `https://stock-analysis.onrender.com`) will be generated for anyone to use!
