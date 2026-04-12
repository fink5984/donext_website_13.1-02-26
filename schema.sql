-- Table: cities
CREATE TABLE cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- Table: streets
CREATE TABLE streets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    city_id INTEGER REFERENCES cities(id)
);

-- Table: countries
CREATE TABLE countries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- Table: currencies
CREATE TABLE currencies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

-- Table: payment_methods
CREATE TABLE payment_methods (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

-- יצירת ENUM type לסטטוסים
CREATE TYPE status_enum AS ENUM (
    'לא נשלח',
    'התקבל',
    'נפתח',
    'הסתיים_בהצלחה'
);

-- Table: clients
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    organization_name VARCHAR(255),
    amuta_number VARCHAR(50),
    subscription_plan VARCHAR(100),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone_landline VARCHAR(30),
    email VARCHAR(255),
    title_before VARCHAR(50),
    title_after VARCHAR(50),
    main_mobile VARCHAR(30),
    secondary_mobile VARCHAR(30),
    street_id INTEGER REFERENCES streets(id),
    house_number VARCHAR(20),
    city_id INTEGER REFERENCES cities(id)
);

-- Table: people
CREATE TABLE people (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone_landline VARCHAR(30),
    email VARCHAR(255),
    title_before VARCHAR(50),
    title_after VARCHAR(50),
    main_mobile VARCHAR(30),
    secondary_mobile VARCHAR(30),
    street_id INTEGER REFERENCES streets(id),
    house_number VARCHAR(20),
    city_id INTEGER REFERENCES cities(id),
    country_id INTEGER REFERENCES countries(id),
    has_existing_hok BOOLEAN,
    client_system_id VARCHAR(100)
);

-- Table: campaign_categories
CREATE TABLE campaign_categories (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id),
    name VARCHAR(255) NOT NULL
);

-- Table: campaigns
CREATE TABLE campaigns (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id),
    name VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    logo VARCHAR(255),
    is_single_day BOOLEAN,
    start_date DATE,
    end_date DATE,
    donation_type VARCHAR(50),
    target_amount NUMERIC(18,2),
    category_id INTEGER REFERENCES campaign_categories(id),
    require_payment_method BOOLEAN,
    currency_id INTEGER REFERENCES currencies(id),
    donation_ranks JSONB,
    questionnaire_type VARCHAR(50) DEFAULT 'קלאסי'
);

-- Table: fundraisers
CREATE TABLE fundraisers (
    id SERIAL PRIMARY KEY,
    person_id INTEGER REFERENCES people(id),
    campaign_id INTEGER REFERENCES campaigns(id),
    status_forecast status_enum DEFAULT 'לא נשלח',
    status_questionnaire status_enum DEFAULT 'לא נשלח'
);

-- Table: donors
CREATE TABLE donors (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id),
    expected NUMERIC(18,2),
    fundraiser_id INTEGER REFERENCES fundraisers(id),
    active BOOLEAN,
    person_id INTEGER REFERENCES people(id),
    traffic_light_color VARCHAR(20)
);

-- Table: donations
CREATE TABLE donations (
    id SERIAL PRIMARY KEY,
    donor_id INTEGER REFERENCES donors(id),
    amount NUMERIC(18,2),
    currency_id INTEGER REFERENCES currencies(id),
    donation_datetime TIMESTAMP,
    payment_method_id INTEGER REFERENCES payment_methods(id),
    payment_method_sorted BOOLEAN
);

-- Indexes for better query performance

-- Foreign key indexes
CREATE INDEX idx_streets_city_id ON streets(city_id);
CREATE INDEX idx_clients_street_id ON clients(street_id);
CREATE INDEX idx_clients_city_id ON clients(city_id);

CREATE INDEX idx_people_client_id ON people(client_id);
CREATE INDEX idx_people_street_id ON people(street_id);
CREATE INDEX idx_people_city_id ON people(city_id);
CREATE INDEX idx_people_country_id ON people(country_id);

CREATE INDEX idx_campaign_categories_client_id ON campaign_categories(client_id);

CREATE INDEX idx_campaigns_client_id ON campaigns(client_id);
CREATE INDEX idx_campaigns_category_id ON campaigns(category_id);
CREATE INDEX idx_campaigns_currency_id ON campaigns(currency_id);
CREATE INDEX idx_campaigns_donation_ranks ON campaigns USING GIN (donation_ranks);

CREATE INDEX idx_fundraisers_person_id ON fundraisers(person_id);
CREATE INDEX idx_fundraisers_campaign_id ON fundraisers(campaign_id);
CREATE INDEX idx_fundraisers_status_forecast ON fundraisers(status_forecast);
CREATE INDEX idx_fundraisers_status_questionnaire ON fundraisers(status_questionnaire);

CREATE INDEX idx_donors_campaign_id ON donors(campaign_id);
CREATE INDEX idx_donors_fundraiser_id ON donors(fundraiser_id);
CREATE INDEX idx_donors_person_id ON donors(person_id);

CREATE INDEX idx_donations_donor_id ON donations(donor_id);
CREATE INDEX idx_donations_currency_id ON donations(currency_id);
CREATE INDEX idx_donations_payment_method_id ON donations(payment_method_id);

-- Composite indexes for common query patterns
CREATE INDEX idx_donors_campaign_active ON donors(campaign_id, active);
CREATE INDEX idx_donors_fundraiser_active ON donors(fundraiser_id, active);
CREATE INDEX idx_donations_datetime ON donations(donation_datetime);
CREATE INDEX idx_campaigns_dates ON campaigns(start_date, end_date);

-- Email and phone indexes for search functionality
CREATE INDEX idx_people_email ON people(email) WHERE email IS NOT NULL;
CREATE INDEX idx_people_main_mobile ON people(main_mobile) WHERE main_mobile IS NOT NULL;
CREATE INDEX idx_clients_email ON clients(email) WHERE email IS NOT NULL;
CREATE INDEX idx_clients_main_mobile ON clients(main_mobile) WHERE main_mobile IS NOT NULL;

-- Name indexes for search
CREATE INDEX idx_people_names ON people(first_name, last_name);
CREATE INDEX idx_clients_name ON clients(name);
CREATE INDEX idx_campaigns_name ON campaigns(name);

-- Traffic light color index for filtering
CREATE INDEX idx_donors_traffic_light ON donors(traffic_light_color) WHERE traffic_light_color IS NOT NULL;

-- Comments for documentation
COMMENT ON TYPE status_enum IS 'סטטוס צפי/שאלון: לא נשלח, התקבל, נפתח, הסתיים_בהצלחה';
COMMENT ON COLUMN fundraisers.status_forecast IS 'סטטוס צפי';
COMMENT ON COLUMN fundraisers.status_questionnaire IS 'סטטוס שאלון';

-- Table: users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'fundraiser',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    logged_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for users table
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_logged_at ON users(logged_at DESC); 