// State Management
let currentTicker = "AAPL";
let currentTimeframe = "1y";
let currentChartStyle = "candle"; // 'candle' or 'line'
let activeTab = "tab-analysis";
let compareTickers = ["AAPL", "MSFT"];
let companyDescription = "";
let stockData = null;
let predictData = null;
let compareData = null;

// Dark theme variables matching style.css
const CHART_THEME = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: {
        family: "'Plus Jakarta Sans', sans-serif",
        color: '#94a3b8'
    },
    gridcolor: 'rgba(255, 255, 255, 0.04)',
    zerolinecolor: 'rgba(255, 255, 255, 0.08)',
    upColor: '#10b981',    // Emerald green
    downColor: '#ef4444',  // Crimson red
    lineColor: '#0ea5e9'   // Cyan blue
};

// DOM Elements Initialization
document.addEventListener("DOMContentLoaded", () => {
    // 1. Set up navigation tabs
    const tabLinks = document.querySelectorAll(".tab-link");
    tabLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            const clickedTab = e.currentTarget.getAttribute("data-tab");
            
            // Switch tabs visually
            tabLinks.forEach(l => l.classList.remove("active"));
            e.currentTarget.classList.add("active");
            
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            document.getElementById(clickedTab).classList.add("active");
            
            activeTab = clickedTab;
            
            // Render specific components if needed
            if (activeTab === "tab-forecast" && !predictData) {
                fetchForecastData(currentTicker);
            } else if (activeTab === "tab-comparison" && !compareData) {
                fetchComparisonData();
            }
            
            // Force redraw of Plotly charts so they fit containers properly
            window.dispatchEvent(new Event('resize'));
        });
    });

    // 2. Set up timeframe selectors
    const timeframeBtns = document.querySelectorAll(".btn-timeframe");
    timeframeBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            timeframeBtns.forEach(b => b.classList.remove("active"));
            e.currentTarget.classList.add("active");
            currentTimeframe = e.currentTarget.getAttribute("data-period");
            
            loadTickerData(currentTicker);
            
            // Reset cached prediction and comparison data since timeframe changed
            predictData = null;
            compareData = null;
            if (activeTab === "tab-forecast") fetchForecastData(currentTicker);
            if (activeTab === "tab-comparison") fetchComparisonData();
        });
    });

    // 3. Set up chart style segmented control
    document.getElementById("btn-style-candle").addEventListener("click", (e) => {
        document.getElementById("btn-style-candle").classList.add("active");
        document.getElementById("btn-style-line").classList.remove("active");
        currentChartStyle = "candle";
        if (stockData) renderCharts();
    });
    
    document.getElementById("btn-style-line").addEventListener("click", (e) => {
        document.getElementById("btn-style-line").classList.add("active");
        document.getElementById("btn-style-candle").classList.remove("active");
        currentChartStyle = "line";
        if (stockData) renderCharts();
    });

    // 4. Set up overlay checklist triggers
    document.getElementById("toggle-sma20").addEventListener("change", () => stockData && renderCharts());
    document.getElementById("toggle-sma50").addEventListener("change", () => stockData && renderCharts());
    document.getElementById("toggle-sma200").addEventListener("change", () => stockData && renderCharts());
    document.getElementById("toggle-bb").addEventListener("change", () => stockData && renderCharts());

    // 5. Popular Suggestion Tickers
    const suggestions = document.querySelectorAll(".suggestion-tag");
    suggestions.forEach(tag => {
        tag.addEventListener("click", (e) => {
            const sym = e.currentTarget.getAttribute("data-symbol");
            currentTicker = sym;
            loadTickerData(currentTicker);
        });
    });

    // 6. Search actions
    const searchInput = document.getElementById("search-input");
    const searchBtn = document.getElementById("search-btn");
    
    searchBtn.addEventListener("click", () => {
        const query = searchInput.value.trim().toUpperCase();
        if (query) {
            currentTicker = query;
            loadTickerData(currentTicker);
        }
    });

    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            const query = searchInput.value.trim().toUpperCase();
            if (query) {
                currentTicker = query;
                loadTickerData(currentTicker);
            }
        }
    });

    // Autocomplete events
    searchInput.addEventListener("input", handleAutocomplete);
    
    // Close autocomplete on click outside
    document.addEventListener("click", (e) => {
        if (e.target !== searchInput) {
            document.getElementById("autocomplete-list").innerHTML = "";
        }
    });

    // 7. CSV Export
    document.getElementById("btn-export-csv").addEventListener("click", () => {
        window.location.href = `/api/export/${currentTicker}?period=${currentTimeframe}`;
    });

    // 8. Description Modal bindings
    const modal = document.getElementById("profile-modal");
    document.getElementById("btn-read-more").addEventListener("click", () => {
        document.getElementById("modal-company-title").innerText = `${currentTicker} - Company Profile`;
        document.getElementById("modal-description").innerText = companyDescription;
        modal.classList.remove("hidden");
    });
    
    document.getElementById("modal-close").addEventListener("click", () => {
        modal.classList.add("hidden");
    });
    
    modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.add("hidden");
    });

    // 9. Comparison controls
    document.getElementById("btn-add-compare").addEventListener("click", addCompareTicker);
    document.getElementById("compare-input").addEventListener("keypress", (e) => {
        if (e.key === "Enter") addCompareTicker();
    });

    // Load initial ticker on app boot
    loadTickerData(currentTicker);
});

// Search Autocomplete filtering
function handleAutocomplete() {
    const input = document.getElementById("search-input");
    const val = input.value.toUpperCase();
    const listContainer = document.getElementById("autocomplete-list");
    listContainer.innerHTML = "";
    
    if (!val) return;
    
    // Filter match symbol or name
    const matches = POPULAR_TICKERS.filter(item => 
        item.symbol.includes(val) || item.name.toUpperCase().includes(val)
    ).slice(0, 6);
    
    matches.forEach(match => {
        const div = document.createElement("div");
        div.innerHTML = `
            <span class="autocomplete-symbol">${match.symbol}</span>
            <span class="autocomplete-name">${match.name}</span>
        `;
        div.addEventListener("click", () => {
            input.value = match.symbol;
            currentTicker = match.symbol;
            listContainer.innerHTML = "";
            loadTickerData(currentTicker);
        });
        listContainer.appendChild(div);
    });
}

// Fetch Stock Metadata & History
function loadTickerData(symbol) {
    showLoader(true);
    hideError();
    
    // Clear prediction & comparison caches so they re-fetch on tab click
    predictData = null;
    compareData = null;
    
    const infoPromise = fetch(`/api/stock/${symbol}`).then(res => {
        if (!res.ok) throw new Error("Failed to load metadata");
        return res.json();
    });
    
    const historyPromise = fetch(`/api/history/${symbol}?period=${currentTimeframe}`).then(res => {
        if (!res.ok) throw new Error("Failed to load history");
        return res.json();
    });
    
    Promise.all([infoPromise, historyPromise])
        .then(([info, history]) => {
            stockData = history;
            companyDescription = info.description;
            
            // 1. Populate metadata cards
            document.getElementById("meta-symbol").innerText = info.symbol;
            document.getElementById("meta-name").innerText = info.name;
            document.getElementById("meta-sector").innerText = info.sector;
            document.getElementById("meta-price").innerText = formatCurrency(info.price);
            
            // Style change percentage
            const changeCont = document.getElementById("meta-change-container");
            const changeVal = document.getElementById("meta-change");
            const changeIcon = document.getElementById("meta-change-icon");
            
            const sign = info.change >= 0 ? "+" : "";
            changeVal.innerText = `${sign}${formatCurrency(info.change)} (${sign}${info.change_percent.toFixed(2)}%)`;
            
            if (info.change >= 0) {
                changeCont.className = "price-change positive";
                changeIcon.className = "fa-solid fa-caret-up";
            } else {
                changeCont.className = "price-change negative";
                changeIcon.className = "fa-solid fa-caret-down";
            }
            
            document.getElementById("meta-description").innerText = info.description;
            
            // Update sector tags in modals
            document.getElementById("modal-sector").innerText = info.sector;
            document.getElementById("modal-industry").innerText = info.industry;
            
            // 2. Metrics panel
            document.getElementById("metric-mcap").innerText = formatLargeNumber(info.market_cap);
            document.getElementById("metric-pe").innerText = info.pe_ratio ? info.pe_ratio.toFixed(2) : "N/A";
            document.getElementById("metric-div").innerText = info.dividend_yield ? `${info.dividend_yield.toFixed(2)}%` : "0.00%";
            document.getElementById("metric-volume").innerText = formatLargeNumber(info.volume);
            document.getElementById("metric-avgvolume").innerText = formatLargeNumber(info.avg_volume);
            document.getElementById("metric-52week").innerText = `${formatCurrency(info.fifty_two_week_low)} - ${formatCurrency(info.fifty_two_week_high)}`;
            
            // 3. Render charts
            renderCharts();
            
            // 4. Update Gauges
            updateGauges();
            
            // 5. Pre-fetch forecast in background if active or cached
            if (activeTab === "tab-forecast") {
                fetchForecastData(symbol);
            }
            if (activeTab === "tab-comparison") {
                fetchComparisonData();
            }
        })
        .catch(err => {
            console.error(err);
            showError(`Ticker Symbol "${symbol}" not found or failed to load. (Details: ${err.message || err})`);
        })
        .finally(() => {
            showLoader(false);
        });
}

// Render Plotly charts (Main chart and Subplots)
function renderCharts() {
    if (!stockData || stockData.length === 0) return;
    
    const dates = stockData.map(d => d.Formatted_Date);
    const close = stockData.map(d => d.Close);
    const volume = stockData.map(d => d.Volume);
    
    // Determine colors for Volume Bars (green if close >= open, else red)
    const volColors = stockData.map(d => {
        const o = d.Open || d.Close;
        const c = d.Close;
        return c >= o ? CHART_THEME.upColor : CHART_THEME.downColor;
    });

    // Traces array
    const dataTraces = [];
    
    // 1. Price Trace (Candlestick or Line)
    if (currentChartStyle === "candle") {
        dataTraces.push({
            x: dates,
            open: stockData.map(d => d.Open),
            high: stockData.map(d => d.High),
            low: stockData.map(d => d.Low),
            close: close,
            type: 'candlestick',
            name: currentTicker,
            yaxis: 'y',
            increasing: { line: { color: CHART_THEME.upColor }, fillcolor: CHART_THEME.upColor },
            decreasing: { line: { color: CHART_THEME.downColor }, fillcolor: CHART_THEME.downColor }
        });
    } else {
        dataTraces.push({
            x: dates,
            y: close,
            type: 'scatter',
            mode: 'lines',
            name: currentTicker,
            yaxis: 'y',
            line: { color: CHART_THEME.lineColor, width: 2.5 }
        });
    }
    
    // 2. Overlays - Moving Averages (SMAs)
    if (document.getElementById("toggle-sma20").checked) {
        dataTraces.push({
            x: dates,
            y: stockData.map(d => d.SMA_20),
            type: 'scatter',
            mode: 'lines',
            name: 'SMA 20',
            yaxis: 'y',
            line: { color: '#38bdf8', width: 1.5 },
            connectgaps: true
        });
    }
    
    if (document.getElementById("toggle-sma50").checked) {
        dataTraces.push({
            x: dates,
            y: stockData.map(d => d.SMA_50),
            type: 'scatter',
            mode: 'lines',
            name: 'SMA 50',
            yaxis: 'y',
            line: { color: '#fb7185', width: 1.5 },
            connectgaps: true
        });
    }
    
    if (document.getElementById("toggle-sma200").checked) {
        dataTraces.push({
            x: dates,
            y: stockData.map(d => d.SMA_200),
            type: 'scatter',
            mode: 'lines',
            name: 'SMA 200',
            yaxis: 'y',
            line: { color: '#a78bfa', width: 1.5 },
            connectgaps: true
        });
    }
    
    // 3. Overlays - Bollinger Bands
    if (document.getElementById("toggle-bb").checked) {
        const bbUpper = stockData.map(d => d.BB_Upper);
        const bbLower = stockData.map(d => d.BB_Lower);
        const bbMiddle = stockData.map(d => d.BB_Middle);
        
        // Lower band (base layer)
        dataTraces.push({
            x: dates,
            y: bbLower,
            type: 'scatter',
            mode: 'lines',
            name: 'BB Lower',
            yaxis: 'y',
            line: { color: 'rgba(251, 191, 36, 0.25)', width: 1 },
            showlegend: false,
            connectgaps: true
        });
        
        // Upper band filling down to Lower band
        dataTraces.push({
            x: dates,
            y: bbUpper,
            type: 'scatter',
            mode: 'lines',
            name: 'Bollinger Bands (20, 2)',
            yaxis: 'y',
            line: { color: 'rgba(251, 191, 36, 0.25)', width: 1 },
            fill: 'tonexty',
            fillcolor: 'rgba(251, 191, 36, 0.04)',
            connectgaps: true
        });
        
        // Middle band
        dataTraces.push({
            x: dates,
            y: bbMiddle,
            type: 'scatter',
            mode: 'lines',
            name: 'BB Middle',
            yaxis: 'y',
            line: { color: 'rgba(251, 191, 36, 0.4)', width: 1, dash: 'dash' },
            showlegend: false,
            connectgaps: true
        });
    }
    
    // 4. Volume Trace (Subplot row 2)
    dataTraces.push({
        x: dates,
        y: volume,
        type: 'bar',
        name: 'Volume',
        yaxis: 'y2',
        marker: { color: volColors },
        showlegend: false
    });

    // Chart layouts
    const layout = {
        paper_bgcolor: CHART_THEME.paper_bgcolor,
        plot_bgcolor: CHART_THEME.plot_bgcolor,
        font: CHART_THEME.font,
        margin: { t: 20, b: 30, l: 50, r: 20 },
        xaxis: {
            gridcolor: CHART_THEME.gridcolor,
            zerolinecolor: CHART_THEME.zerolinecolor,
            rangeslider: { visible: false },
            type: 'category'
        },
        yaxis: {
            domain: [0.3, 1.0],
            gridcolor: CHART_THEME.gridcolor,
            zerolinecolor: CHART_THEME.zerolinecolor,
            title: 'Price ($)'
        },
        yaxis2: {
            domain: [0.0, 0.22],
            gridcolor: CHART_THEME.gridcolor,
            zerolinecolor: CHART_THEME.zerolinecolor,
            title: 'Volume'
        },
        showlegend: true,
        legend: {
            orientation: 'h',
            yanchor: 'bottom',
            y: 1.02,
            xanchor: 'right',
            x: 1
        },
        hovermode: 'x unified'
    };

    Plotly.newPlot('main-price-chart', dataTraces, layout, { responsive: true, displayModeBar: false });

    // 5. Draw Indicator Subplots: RSI
    renderRsiChart(dates);
    
    // 6. Draw Indicator Subplots: MACD
    renderMacdChart(dates);
}

// Render RSI indicator chart
function renderRsiChart(dates) {
    const rsi = stockData.map(d => d.RSI);
    
    const rsiTrace = {
        x: dates,
        y: rsi,
        type: 'scatter',
        mode: 'lines',
        name: 'RSI',
        line: { color: '#a78bfa', width: 2 },
        connectgaps: true
    };
    
    const rsiLayout = {
        paper_bgcolor: CHART_THEME.paper_bgcolor,
        plot_bgcolor: CHART_THEME.plot_bgcolor,
        font: CHART_THEME.font,
        margin: { t: 10, b: 20, l: 40, r: 20 },
        xaxis: { gridcolor: CHART_THEME.gridcolor, showticklabels: false, type: 'category' },
        yaxis: {
            gridcolor: CHART_THEME.gridcolor,
            range: [10, 90],
            tickvals: [30, 50, 70]
        },
        shapes: [
            // Upper band limit line (70)
            {
                type: 'line', x0: 0, x1: dates.length - 1, y0: 70, y1: 70,
                line: { color: 'rgba(239, 68, 68, 0.4)', width: 1, dash: 'dash' }
            },
            // Lower band limit line (30)
            {
                type: 'line', x0: 0, x1: dates.length - 1, y0: 30, y1: 30,
                line: { color: 'rgba(16, 185, 129, 0.4)', width: 1, dash: 'dash' }
            }
        ],
        hovermode: 'x unified',
        showlegend: false
    };
    
    Plotly.newPlot('rsi-chart', [rsiTrace], rsiLayout, { responsive: true, displayModeBar: false });
    
    // Update RSI badge label
    if (rsi.length > 0) {
        const lastRsi = rsi[rsi.length - 1];
        const badge = document.getElementById("rsi-val-badge");
        if (lastRsi !== null && lastRsi !== undefined) {
            badge.innerText = `RSI: ${lastRsi.toFixed(2)}`;
            if (lastRsi >= 70) {
                badge.className = "badge-bearish";
            } else if (lastRsi <= 30) {
                badge.className = "badge-bullish";
            } else {
                badge.className = "badge-neutral";
            }
        }
    }
}

// Render MACD indicator chart
function renderMacdChart(dates) {
    const macd = stockData.map(d => d.MACD);
    const signal = stockData.map(d => d.MACD_Signal);
    const hist = stockData.map(d => d.MACD_Hist);
    
    const macdTrace = {
        x: dates, y: macd, type: 'scatter', mode: 'lines', name: 'MACD',
        line: { color: '#38bdf8', width: 1.5 }, connectgaps: true
    };
    
    const signalTrace = {
        x: dates, y: signal, type: 'scatter', mode: 'lines', name: 'Signal',
        line: { color: '#fb923c', width: 1.5 }, connectgaps: true
    };
    
    const histColors = hist.map(val => val >= 0 ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)');
    const histTrace = {
        x: dates, y: hist, type: 'bar', name: 'Hist',
        marker: { color: histColors }, showlegend: false
    };
    
    const macdLayout = {
        paper_bgcolor: CHART_THEME.paper_bgcolor,
        plot_bgcolor: CHART_THEME.plot_bgcolor,
        font: CHART_THEME.font,
        margin: { t: 10, b: 20, l: 40, r: 20 },
        xaxis: { gridcolor: CHART_THEME.gridcolor, showticklabels: false, type: 'category' },
        yaxis: { gridcolor: CHART_THEME.gridcolor },
        hovermode: 'x unified',
        showlegend: true,
        legend: { orientation: 'h', y: 1.15, x: 1, xanchor: 'right' }
    };
    
    Plotly.newPlot('macd-chart', [histTrace, macdTrace, signalTrace], macdLayout, { responsive: true, displayModeBar: false });
    
    // Update MACD badge label
    if (macd.length > 0) {
        const lastMacd = macd[macd.length - 1];
        const lastSig = signal[signal.length - 1];
        const badge = document.getElementById("macd-val-badge");
        if (lastMacd !== null && lastSig !== null) {
            badge.innerText = `MACD: ${lastMacd.toFixed(2)} | Sig: ${lastSig.toFixed(2)}`;
            if (lastMacd >= lastSig) {
                badge.className = "badge-bullish";
            } else {
                badge.className = "badge-bearish";
            }
        }
    }
}

// Compute indicator metrics gauges values
function updateGauges() {
    if (!stockData || stockData.length < 5) return;
    
    const lastRec = stockData[stockData.length - 1];
    
    // 1. RSI state
    const rsiVal = lastRec.RSI;
    const rsiPill = document.getElementById("gauge-rsi-pill");
    const rsiDesc = document.getElementById("gauge-rsi-desc");
    
    if (rsiVal !== null && rsiVal !== undefined) {
        if (rsiVal >= 70) {
            rsiPill.className = "signal-pill bearish";
            rsiPill.innerText = "Overbought";
            rsiDesc.innerText = `RSI stands at ${rsiVal.toFixed(1)}. The asset is highly overextended on buying volume, signaling potential overhead resistance and profit-taking correction.`;
        } else if (rsiVal <= 30) {
            rsiPill.className = "signal-pill bullish";
            rsiPill.innerText = "Oversold";
            rsiDesc.innerText = `RSI stands at ${rsiVal.toFixed(1)}. The asset has experienced strong sell-side exhaustion, putting it in oversold territory which commonly precedes technical bounces.`;
        } else {
            rsiPill.className = "signal-pill neutral";
            rsiPill.innerText = "Neutral";
            rsiDesc.innerText = `RSI stands at ${rsiVal.toFixed(1)}. Buying and selling pressure are balanced, keeping momentum indicators resting in neutral ranges.`;
        }
    }
    
    // 2. MACD Crossover
    const macdVal = lastRec.MACD;
    const signalVal = lastRec.MACD_Signal;
    const macdPill = document.getElementById("gauge-macd-pill");
    const macdDesc = document.getElementById("gauge-macd-desc");
    
    if (macdVal !== null && signalVal !== null) {
        // Look back for crossover
        const prevRec = stockData[stockData.length - 2];
        const wasBelow = prevRec.MACD < prevRec.MACD_Signal;
        const wasAbove = prevRec.MACD > prevRec.MACD_Signal;
        
        if (macdVal > signalVal && wasBelow) {
            macdPill.className = "signal-pill bullish";
            macdPill.innerText = "Bullish Cross";
            macdDesc.innerText = "The MACD line crossed ABOVE the Signal line on the last candle, triggering a standard momentum buy signal indicating buyers are gaining control.";
        } else if (macdVal < signalVal && wasAbove) {
            macdPill.className = "signal-pill bearish";
            macdPill.innerText = "Bearish Cross";
            macdDesc.innerText = "The MACD line crossed BELOW the Signal line on the last candle, triggering a momentum sell signal suggesting downward price pressure is compounding.";
        } else if (macdVal > signalVal) {
            macdPill.className = "signal-pill bullish";
            macdPill.innerText = "Bullish Trend";
            macdDesc.innerText = "MACD line resides above the Signal line, confirming that short-term momentum is upwards and the upward trend remains intact.";
        } else {
            macdPill.className = "signal-pill bearish";
            macdPill.innerText = "Bearish Trend";
            macdDesc.innerText = "MACD line resides below the Signal line, confirming that short-term momentum is downwards and consolidation/distribution is ongoing.";
        }
    }
    
    // 3. Bollinger Bands Touch
    const closeVal = lastRec.Close;
    const upperBB = lastRec.BB_Upper;
    const lowerBB = lastRec.BB_Lower;
    const bbPill = document.getElementById("gauge-bb-pill");
    const bbDesc = document.getElementById("gauge-bb-desc");
    
    if (closeVal !== null && upperBB !== null && lowerBB !== null) {
        if (closeVal >= upperBB) {
            bbPill.className = "signal-pill bearish";
            bbPill.innerText = "Upper BB Touch";
            bbDesc.innerText = `Price ($${closeVal.toFixed(2)}) is resting above the Upper Bollinger Band ($${upperBB.toFixed(2)}). This suggests price is highly volatile and overextended (outside 2 standard deviations).`;
        } else if (closeVal <= lowerBB) {
            bbPill.className = "signal-pill bullish";
            bbPill.innerText = "Lower BB Touch";
            bbDesc.innerText = `Price ($${closeVal.toFixed(2)}) is touching the Lower Bollinger Band ($${lowerBB.toFixed(2)}). It is testing statistical oversold boundaries, which may act as immediate technical support.`;
        } else {
            bbPill.className = "signal-pill neutral";
            bbPill.innerText = "Inside Bands";
            bbDesc.innerText = `Price is resting comfortably inside the band channels ($${lowerBB.toFixed(2)} to $${upperBB.toFixed(2)}), exhibiting standard volatility profiles with no immediate breakouts.`;
        }
    }
}

// Fetch ML 30-Day price projection
function fetchForecastData(symbol) {
    showLoader(true);
    fetch(`/api/predict/${symbol}`)
        .then(res => {
            if (!res.ok) throw new Error("Forecast failed");
            return res.json();
        })
        .then(data => {
            predictData = data;
            
            // Populate metrics
            document.getElementById("forecast-last-close").innerText = formatCurrency(data.current_price);
            document.getElementById("forecast-projected").innerText = formatCurrency(data.projected_price);
            
            const sign = data.percent_change >= 0 ? "+" : "";
            const yieldEl = document.getElementById("forecast-yield");
            yieldEl.innerText = `${sign}${data.percent_change.toFixed(2)}%`;
            if (data.percent_change >= 0) {
                yieldEl.className = "stat-value positive";
            } else {
                yieldEl.className = "stat-value negative";
            }
            
            // Update signal pill
            const pill = document.getElementById("forecast-signal-pill");
            pill.innerText = data.signal;
            if (data.signal.includes("Bullish")) {
                pill.className = "signal-pill large bullish";
            } else if (data.signal.includes("Bearish")) {
                pill.className = "signal-pill large bearish";
            } else {
                pill.className = "signal-pill large neutral";
            }
            
            renderForecastChart();
        })
        .catch(err => {
            console.error("Forecast fetch error: ", err);
        })
        .finally(() => {
            showLoader(false);
        });
}

// Render Forecast Chart
function renderForecastChart() {
    if (!predictData) return;
    
    // Historical prices
    const histDates = predictData.historical.map(h => h.date);
    const histPrices = predictData.historical.map(h => h.close);
    
    // Forecast prices
    const foreDates = predictData.forecast.map(f => f.date);
    const forePrices = predictData.forecast.map(f => f.predicted);
    const foreUpper = predictData.forecast.map(f => f.upper);
    const foreLower = predictData.forecast.map(f => f.lower);
    
    // Compile traces
    const traces = [];
    
    // Trace 1: Historical Data
    traces.push({
        x: histDates,
        y: histPrices,
        type: 'scatter',
        mode: 'lines',
        name: 'Historical Close',
        line: { color: 'rgba(148, 163, 184, 0.6)', width: 2 }
    });
    
    // Trace 2: Future Lower bounds
    traces.push({
        x: foreDates,
        y: foreLower,
        type: 'scatter',
        mode: 'lines',
        name: '95% Lower Limit',
        line: { color: 'rgba(14, 165, 233, 0.05)', width: 0.5 },
        showlegend: false
    });
    
    // Trace 3: Future Upper bounds (fills down to Lower limit)
    traces.push({
        x: foreDates,
        y: foreUpper,
        type: 'scatter',
        mode: 'lines',
        name: '95% Confidence Band',
        line: { color: 'rgba(14, 165, 233, 0.05)', width: 0.5 },
        fill: 'tonexty',
        fillcolor: 'rgba(14, 165, 233, 0.08)'
    });
    
    // Trace 4: Future Predicted Line
    traces.push({
        x: foreDates,
        y: forePrices,
        type: 'scatter',
        mode: 'lines',
        name: 'Projected Trend',
        line: { color: '#8b5cf6', width: 2.5 } // purple prediction line
    });
    
    const layout = {
        paper_bgcolor: CHART_THEME.paper_bgcolor,
        plot_bgcolor: CHART_THEME.plot_bgcolor,
        font: CHART_THEME.font,
        margin: { t: 20, b: 30, l: 50, r: 20 },
        xaxis: { gridcolor: CHART_THEME.gridcolor, zerolinecolor: CHART_THEME.zerolinecolor },
        yaxis: { gridcolor: CHART_THEME.gridcolor, zerolinecolor: CHART_THEME.zerolinecolor, title: 'Price ($)' },
        legend: { orientation: 'h', y: 1.05, x: 1, xanchor: 'right' },
        hovermode: 'x unified'
    };
    
    Plotly.newPlot('forecast-price-chart', traces, layout, { responsive: true, displayModeBar: false });
}

// Fetch stock comparison data
function fetchComparisonData() {
    if (compareTickers.length === 0) {
        Plotly.purge('comparison-chart');
        return;
    }
    
    showLoader(true);
    const ticksParam = compareTickers.join(",");
    
    fetch(`/api/compare?tickers=${ticksParam}&period=${currentTimeframe}`)
        .then(res => {
            if (!res.ok) throw new Error("Comparison failed");
            return res.json();
        })
        .then(data => {
            compareData = data;
            renderComparisonChart();
        })
        .catch(err => {
            console.error("Comparison fetch error: ", err);
        })
        .finally(() => {
            showLoader(false);
        });
}

// Render Comparison Chart
function renderComparisonChart() {
    if (!compareData) return;
    
    const colorCycle = ['#0ea5e9', '#10b981', '#fb7185', '#fb923c', '#a78bfa', '#f43f5e'];
    const traces = [];
    let colorIdx = 0;
    
    for (const sym in compareData) {
        const dataset = compareData[sym];
        const dates = dataset.map(d => d.date);
        const returns = dataset.map(d => d.percent_return);
        
        traces.push({
            x: dates,
            y: returns,
            type: 'scatter',
            mode: 'lines',
            name: sym,
            line: { color: colorCycle[colorIdx % colorCycle.length], width: 2 }
        });
        colorIdx++;
    }
    
    const layout = {
        paper_bgcolor: CHART_THEME.paper_bgcolor,
        plot_bgcolor: CHART_THEME.plot_bgcolor,
        font: CHART_THEME.font,
        margin: { t: 20, b: 30, l: 50, r: 20 },
        xaxis: { gridcolor: CHART_THEME.gridcolor, zerolinecolor: CHART_THEME.zerolinecolor },
        yaxis: { 
            gridcolor: CHART_THEME.gridcolor, 
            zerolinecolor: CHART_THEME.zerolinecolor, 
            title: 'Percentage Return (%)',
            ticksuffix: '%'
        },
        legend: { orientation: 'h', y: 1.05, x: 1, xanchor: 'right' },
        hovermode: 'x unified'
    };
    
    Plotly.newPlot('comparison-chart', traces, layout, { responsive: true, displayModeBar: false });
}

// Add ticker to comparison panel
function addCompareTicker() {
    const input = document.getElementById("compare-input");
    const val = input.value.trim().toUpperCase();
    
    if (val && !compareTickers.includes(val)) {
        // Limit comparison to 5 stocks for visual clarity
        if (compareTickers.length >= 5) {
            alert("Maximum comparison limit of 5 ticker symbols reached.");
            return;
        }
        
        // Show tag in container
        compareTickers.push(val);
        input.value = "";
        
        renderCompareTags();
        fetchComparisonData();
    }
}

// Remove ticker from comparison list
function removeCompareTicker(symbol) {
    compareTickers = compareTickers.filter(t => t !== symbol);
    renderCompareTags();
    fetchComparisonData();
}

// Redraw compare tags list
function renderCompareTags() {
    const container = document.getElementById("comparison-tags-container");
    container.innerHTML = "";
    
    compareTickers.forEach(tick => {
        const div = document.createElement("div");
        div.className = "compare-tag";
        div.setAttribute("data-symbol", tick);
        div.innerHTML = `
            ${tick} 
            <i class="fa-solid fa-xmark compare-remove"></i>
        `;
        // Attach click handler specifically to the remove X icon
        div.querySelector(".compare-remove").addEventListener("click", () => {
            removeCompareTicker(tick);
        });
        container.appendChild(div);
    });
}

// Helper utility: Loader Overlay toggle
function showLoader(visible) {
    const loader = document.getElementById("loader-overlay");
    if (visible) {
        loader.classList.remove("hidden");
    } else {
        loader.classList.add("hidden");
    }
}

// Helper utility: Display Error Box
function showError(msg) {
    const banner = document.getElementById("error-banner");
    const errText = document.getElementById("error-message");
    errText.innerText = msg;
    banner.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Helper utility: Hide Error Box
function hideError() {
    document.getElementById("error-banner").classList.add("hidden");
}

// Formatting Numbers and Currencies
function formatCurrency(val) {
    if (val === null || val === undefined) return "$0.00";
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}

function formatLargeNumber(val) {
    if (val === null || val === undefined || isNaN(val)) return "-";
    if (val >= 1e12) return (val / 1e12).toFixed(2) + "T";
    if (val >= 1e9) return (val / 1e9).toFixed(2) + "B";
    if (val >= 1e6) return (val / 1e6).toFixed(2) + "M";
    return new Intl.NumberFormat('en-US').format(val);
}
