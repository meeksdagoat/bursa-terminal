# Bursa Terminal

**A financial analytics platform focused on Bursa Malaysia.**

Bursa Terminal is a web-based platform designed to make stock market research and financial analysis more accessible to Malaysians, particularly those who are new to investing.

Inspired by Bloomberg Terminal, the project brings together company information, market data, financial analysis tools, and economic news in a simpler, freely accessible interface.

**Live website:** https://www.bursaterminal.com/

## Features

### Market Research
- Stock prices and historical price charts
- Company financial statements and performance metrics
- Technical analysis tools
- Company-specific news
- Local and global economic and political news

### Quant Hub
Quant Hub provides interactive tools for exploring financial mathematics and quantitative analysis.

Its features include:

- **Monte Carlo Simulation:** Explore potential market outcomes using historical returns and stochastic modelling.
- **Strategy Backtesting:** Examine how trading strategies would have performed using historical data.
- **Efficient Frontier:** Explore portfolio risk and return using concepts from Modern Portfolio Theory.
- **Value at Risk (VaR):** Estimate potential portfolio losses under specified assumptions.
- **Warrant Pricing:** Explore theoretical pricing using the Black–Scholes model.
- **Statistical Arbitrage:** Analyse relationships between pairs of securities.
- **Market Regime Analysis:** Explore market conditions using statistical models.
- **Factor and Alternative Data Analysis:** Investigate additional signals that may influence financial markets.

## Motivation

I created Bursa Terminal because I believe access to financial knowledge should not depend on someone's wealth.

I wanted to build a platform that could help Malaysians explore financial markets while making mathematical and quantitative concepts more approachable.

## Development

I researched the financial and mathematical concepts, planned the features, and directed the development of Bursa Terminal.

I used Cursor to generate and implement code based on my specifications. For example, I specified the historical mean returns and standard deviation used by the Monte Carlo simulator, while Cursor generated the implementation.

I independently handled deployment through Vercel.

## Technology and Data Sources

- **Framework:** Next.js
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Deployment:** Vercel
- **Financial data:** Yahoo Finance, Bursa Malaysia, and KLSE Screener APIs
- **News:** External financial and news websites

## Limitations

Bursa Terminal is an educational and exploratory project, not a professional trading or investment advisory system.

The Monte Carlo simulator uses historical return statistics and does not fully account for changing market regimes, volatility dynamics, or other complex market factors.

Quantitative results depend on model assumptions and historical data, and should not be interpreted as reliable predictions of future market performance.

## Future Improvements

I hope to continue developing Bursa Terminal by improving the accuracy and reliability of its quantitative models, expanding its analytical capabilities, and making financial concepts easier for everyday users to understand.

---

*Bursa Terminal is intended for educational and informational purposes, not financial advice.*
