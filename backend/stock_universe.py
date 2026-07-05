"""NSE stock universe - curated list of liquid stocks with sector mapping."""

# Curated universe: liquid, quality NSE stocks. Yahoo Finance symbol = SYMBOL.NS
NSE_UNIVERSE = [
    # IT
    {"symbol": "TCS.NS", "name": "Tata Consultancy Services", "sector": "IT"},
    {"symbol": "INFY.NS", "name": "Infosys", "sector": "IT"},
    {"symbol": "WIPRO.NS", "name": "Wipro", "sector": "IT"},
    {"symbol": "HCLTECH.NS", "name": "HCL Technologies", "sector": "IT"},
    {"symbol": "TECHM.NS", "name": "Tech Mahindra", "sector": "IT"},
    {"symbol": "LTIM.NS", "name": "LTIMindtree", "sector": "IT"},
    # Banking
    {"symbol": "HDFCBANK.NS", "name": "HDFC Bank", "sector": "Banking"},
    {"symbol": "ICICIBANK.NS", "name": "ICICI Bank", "sector": "Banking"},
    {"symbol": "SBIN.NS", "name": "State Bank of India", "sector": "Banking"},
    {"symbol": "AXISBANK.NS", "name": "Axis Bank", "sector": "Banking"},
    {"symbol": "KOTAKBANK.NS", "name": "Kotak Mahindra Bank", "sector": "Banking"},
    {"symbol": "INDUSINDBK.NS", "name": "IndusInd Bank", "sector": "Banking"},
    # Pharma
    {"symbol": "SUNPHARMA.NS", "name": "Sun Pharmaceutical", "sector": "Pharma"},
    {"symbol": "DRREDDY.NS", "name": "Dr. Reddy's Laboratories", "sector": "Pharma"},
    {"symbol": "CIPLA.NS", "name": "Cipla", "sector": "Pharma"},
    {"symbol": "DIVISLAB.NS", "name": "Divi's Laboratories", "sector": "Pharma"},
    # Capital Goods / Infrastructure
    {"symbol": "LT.NS", "name": "Larsen & Toubro", "sector": "Capital Goods"},
    {"symbol": "SIEMENS.NS", "name": "Siemens", "sector": "Capital Goods"},
    {"symbol": "ABB.NS", "name": "ABB India", "sector": "Capital Goods"},
    # Defense
    {"symbol": "HAL.NS", "name": "Hindustan Aeronautics", "sector": "Defense"},
    {"symbol": "BEL.NS", "name": "Bharat Electronics", "sector": "Defense"},
    # Power
    {"symbol": "NTPC.NS", "name": "NTPC", "sector": "Power"},
    {"symbol": "POWERGRID.NS", "name": "Power Grid Corporation", "sector": "Power"},
    {"symbol": "TATAPOWER.NS", "name": "Tata Power", "sector": "Power"},
    # Railways
    {"symbol": "IRCTC.NS", "name": "IRCTC", "sector": "Railways"},
    {"symbol": "RVNL.NS", "name": "Rail Vikas Nigam", "sector": "Railways"},
    # FMCG
    {"symbol": "HINDUNILVR.NS", "name": "Hindustan Unilever", "sector": "FMCG"},
    {"symbol": "ITC.NS", "name": "ITC", "sector": "FMCG"},
    {"symbol": "NESTLEIND.NS", "name": "Nestle India", "sector": "FMCG"},
    # Auto
    {"symbol": "MARUTI.NS", "name": "Maruti Suzuki", "sector": "Auto"},
    {"symbol": "M&M.NS", "name": "Mahindra & Mahindra", "sector": "Auto"},
    {"symbol": "TATAMOTORS.NS", "name": "Tata Motors", "sector": "Auto"},
    {"symbol": "BAJAJ-AUTO.NS", "name": "Bajaj Auto", "sector": "Auto"},
    # Energy / Metals
    {"symbol": "RELIANCE.NS", "name": "Reliance Industries", "sector": "Energy"},
    {"symbol": "ONGC.NS", "name": "Oil & Natural Gas Corporation", "sector": "Energy"},
    {"symbol": "TATASTEEL.NS", "name": "Tata Steel", "sector": "Metals"},
    {"symbol": "JSWSTEEL.NS", "name": "JSW Steel", "sector": "Metals"},
    {"symbol": "HINDALCO.NS", "name": "Hindalco Industries", "sector": "Metals"},
    # Telecom
    {"symbol": "BHARTIARTL.NS", "name": "Bharti Airtel", "sector": "Telecom"},
    # Cement
    {"symbol": "ULTRACEMCO.NS", "name": "UltraTech Cement", "sector": "Cement"},
    {"symbol": "GRASIM.NS", "name": "Grasim Industries", "sector": "Cement"},
]

INDEX_SYMBOLS = {
    "NIFTY50": "^NSEI",
    "NIFTY500": "^CRSLDX",
    "SENSEX": "^BSESN",
}

def get_symbols():
    return [s["symbol"] for s in NSE_UNIVERSE]

def get_stock_info(symbol):
    for s in NSE_UNIVERSE:
        if s["symbol"] == symbol:
            return s
    return None
