

# AutoSage - Car Buying Decision Support Tool

A consumer-friendly web app that provides expert-level analysis and recommendations for used and new car purchases.

## Core Features

### 1. Smart Vehicle Input
- **VIN Lookup** - Enter a VIN to automatically decode year, make, model, and trim
- **Manual Entry** - Alternative input for make/model/trim if VIN unavailable
- **Listing Import** - Paste a URL from popular car sites (AutoTrader, Cars.com, Carvana, etc.) and auto-extract vehicle details via web scraping including assessment of vehicle condition from available photos on the listing
- **Condition Details** - Mileage, asking price, and general condition assessment

### 2. Carfax/Vehicle History Analysis
- **PDF Upload** - Upload Carfax or other vehicle history reports; AI extracts and analyzes accident history, service records, title status, and ownership history
- **Link Scraping** - If user provides a Carfax link, attempt to scrape key details
- **AI-Powered Insights** - Identify red flags, maintenance patterns, and overall vehicle health score

### 3. Fair Market Price Assessment
- **Current Market Value** - AI-powered estimate based on year/make/model, mileage, condition, and market trends
- **Private Sale vs Trade-In** - Show both values with explanation of the difference
- **Deal Rating** - Visual gauge showing if the asking price is below/at/above market value

### 4. 5-Year Depreciation & Equity Calculator
- **Interactive Loan Calculator** - User inputs loan term, amount financed, and APR or Lease term, including lease term, mileage allowance per year, monthly payment (incl tax), residual, month remaining and current mileage.
- **Year-by-Year Projection Table**:
  - Estimated market value (private sale)
  - Trade-in value
  - Remaining loan balance or project lease payoff
  - Anticipated repair costs (based on reliability data for that model) while giving consideration to factory warranty remaining on the vehicle
  - Net equity position (In Green if positive, In Red if Negative)
- **Visual Charts** - Line graphs showing depreciation curve vs loan/lease payoff trajectory

### 5. Expert Recommendation Summary
- **Risk Assessment** - Low/Medium/High risk rating with visual indicator
- **Key Factors** - Bullet points covering depreciation risk, reliability concerns, and value proposition
- **Fair Offer Price** - Suggested negotiation target based on all factors
- **AI Expert Opinion** - Detailed analysis written as if from an expert mechanic and car buyer
- ** If user is comparing vehicles, offer a recommendation on which car is a better buy based on all the findings and provide an explanation.

### 6. User Accounts & Report Management
- **Email/Password Authentication** - Simple signup and login
- **Saved Reports** - Save unlimited vehicle analyses for later review
- **Compare Mode** - Side-by-side comparison of up to 3 vehicles; Compare mode is a paid feature. Either one time of $7.95 or monthly subscription for unlimited at $14.95
- **Report History** - Access all past analyses with search/filter

## Design Approach
- Modern card-based layout with clean typography
- Visual gauges, progress bars, and color-coded indicators (green/yellow/red)
- Interactive charts for depreciation visualization
- Mobile-responsive for on-the-go dealership visits
- Dark/light mode support

## Technical Implementation
- **AI Analysis** - Lovable AI (Gemini) for pricing estimates, risk assessment, and expert recommendations
- **Web Scraping** - Firecrawl integration for extracting listing and Carfax data
- **Document Parsing** - PDF upload with AI extraction of vehicle history details
- **User Authentication** - Supabase Auth for account management
- **Data Storage** - Supabase database for saving reports and user profiles
- **Integrate with NTHSA db initially as it's free and doesn't require an API key, for the purpose of basic VIN decoding
- Leave room for Adsense ads in strategic but not annoying places, leaving the UI clean looking.

## Pages Structure
1. **Home/Landing** - Hero section explaining the tool, CTA to start analysis
2. **New Analysis** - Multi-step form for entering vehicle details
3. **Report View** - Full analysis with all sections (pricing, depreciation, recommendations); This must require the user to sign up for a free account with validated email. 
4. **Dashboard** - User's saved reports and comparison view (only if on monthly subscription)
5. **Login/Signup** - Simple authentication pages

