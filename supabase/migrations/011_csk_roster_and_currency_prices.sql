-- ============================================================
-- 011_csk_roster_and_currency_prices.sql
-- Add base_price_usd to players, standardise all base prices,
-- and replace the CSK roster with the 2025 squad.
-- ============================================================

-- 1. Add base_price_usd column
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS base_price_usd INTEGER NOT NULL DEFAULT 1000;

-- 2. Standardise ALL existing players: ₹1L / $1000
UPDATE players SET base_price = 1, base_price_usd = 1000;

-- 3. Remove FK-dependent rows for all 10 teams being replaced,
--    then delete the old player rows.
DO $$
DECLARE
  old_ids UUID[];
  team_names TEXT[] := ARRAY[
    'Chennai Super Kings', 'Delhi Capitals', 'Gujarat Titans',
    'Kolkata Knight Riders', 'Lucknow Super Giants', 'Mumbai Indians',
    'Punjab Kings', 'Rajasthan Royals', 'Royal Challengers Bengaluru',
    'Sunrisers Hyderabad'
  ];
BEGIN
  SELECT ARRAY(SELECT id FROM players WHERE ipl_team = ANY(team_names))
    INTO old_ids;

  DELETE FROM player_interests    WHERE player_id = ANY(old_ids);
  DELETE FROM match_scores        WHERE player_id = ANY(old_ids);
  DELETE FROM bids                WHERE player_id = ANY(old_ids);
  DELETE FROM team_rosters        WHERE player_id = ANY(old_ids);
  DELETE FROM auction_player_queue WHERE player_id = ANY(old_ids);
  DELETE FROM players             WHERE id         = ANY(old_ids);
END $$;

-- (Individual per-team DELETE statements below are now no-ops but kept for clarity)
-- Remove old CSK players
DELETE FROM players WHERE ipl_team = 'Chennai Super Kings';

-- 4. Insert updated CSK 2025 roster
INSERT INTO players (name, ipl_team, role, base_price, base_price_usd, nationality, ipl_season) VALUES
-- Batters
('Ruturaj Gaikwad',   'Chennai Super Kings', 'batsman',       1, 1000, 'Indian',       2025),
('Dewald Brevis',     'Chennai Super Kings', 'batsman',       1, 1000, 'South African', 2025),
('MS Dhoni',          'Chennai Super Kings', 'wicket_keeper', 1, 1000, 'Indian',        2025),
('Kartik Sharma',     'Chennai Super Kings', 'wicket_keeper', 1, 1000, 'Indian',        2025),
('Sarfaraz Khan',     'Chennai Super Kings', 'batsman',       1, 1000, 'Indian',        2025),
('Ayush Mhatre',      'Chennai Super Kings', 'batsman',       1, 1000, 'Indian',        2025),
('Urvil Patel',       'Chennai Super Kings', 'wicket_keeper', 1, 1000, 'Indian',        2025),
('Sanju Samson',      'Chennai Super Kings', 'wicket_keeper', 1, 1000, 'Indian',        2025),
-- All-rounders
('Aman Khan',         'Chennai Super Kings', 'all_rounder',   1, 1000, 'Indian',        2025),
('Shivam Dube',       'Chennai Super Kings', 'all_rounder',   1, 1000, 'Indian',        2025),
('Zak Foulkes',       'Chennai Super Kings', 'all_rounder',   1, 1000, 'English',       2025),
('Ramakrishna Ghosh', 'Chennai Super Kings', 'all_rounder',   1, 1000, 'Indian',        2025),
('Anshul Kamboj',     'Chennai Super Kings', 'all_rounder',   1, 1000, 'Indian',        2025),
('Jamie Overton',     'Chennai Super Kings', 'all_rounder',   1, 1000, 'English',       2025),
('Matthew Short',     'Chennai Super Kings', 'all_rounder',   1, 1000, 'Australian',    2025),
('Prashant Veer',     'Chennai Super Kings', 'all_rounder',   1, 1000, 'Indian',        2025),
-- Bowlers
('Khaleel Ahmed',     'Chennai Super Kings', 'bowler',        1, 1000, 'Indian',        2025),
('Rahul Chahar',      'Chennai Super Kings', 'bowler',        1, 1000, 'Indian',        2025),
('Shreyas Gopal',     'Chennai Super Kings', 'bowler',        1, 1000, 'Indian',        2025),
('Gurjapneet Singh',  'Chennai Super Kings', 'bowler',        1, 1000, 'Indian',        2025),
('Matt Henry',        'Chennai Super Kings', 'bowler',        1, 1000, 'New Zealander', 2025),
('Akeal Hosein',      'Chennai Super Kings', 'bowler',        1, 1000, 'West Indian',   2025),
('Spencer Johnson',   'Chennai Super Kings', 'bowler',        1, 1000, 'Australian',    2025),
('Mukesh Choudhary',  'Chennai Super Kings', 'bowler',        1, 1000, 'Indian',        2025),
('Noor Ahmad',        'Chennai Super Kings', 'bowler',        1, 1000, 'Afghan',        2025);
-- Nathan Ellis excluded (withdrawn)

-- ============================================================
-- Delhi Capitals 2025 roster
-- ============================================================
DELETE FROM players WHERE ipl_team = 'Delhi Capitals';

INSERT INTO players (name, ipl_team, role, base_price, base_price_usd, nationality, ipl_season) VALUES
-- Batters
('Abishek Porel',    'Delhi Capitals', 'wicket_keeper', 1, 1000, 'Indian',        2025),
('David Miller',     'Delhi Capitals', 'batsman',       1, 1000, 'South African', 2025),
('Karun Nair',       'Delhi Capitals', 'batsman',       1, 1000, 'Indian',        2025),
('Pathum Nissanka',  'Delhi Capitals', 'batsman',       1, 1000, 'Sri Lankan',    2025),
('Sahil Parakh',     'Delhi Capitals', 'batsman',       1, 1000, 'Indian',        2025),
('KL Rahul',         'Delhi Capitals', 'wicket_keeper', 1, 1000, 'Indian',        2025),
('Nitish Rana',      'Delhi Capitals', 'batsman',       1, 1000, 'Indian',        2025),
('Prithvi Shaw',     'Delhi Capitals', 'batsman',       1, 1000, 'Indian',        2025),
('Tristan Stubbs',   'Delhi Capitals', 'wicket_keeper', 1, 1000, 'South African', 2025),
-- All-rounders (Ben Duckett excluded — withdrawn)
('Axar Patel',       'Delhi Capitals', 'all_rounder',   1, 1000, 'Indian',        2025),
('Ajay Mandal',      'Delhi Capitals', 'all_rounder',   1, 1000, 'Indian',        2025),
('Sameer Rizvi',     'Delhi Capitals', 'all_rounder',   1, 1000, 'Indian',        2025),
('Ashutosh Sharma',  'Delhi Capitals', 'all_rounder',   1, 1000, 'Indian',        2025),
('Madhav Tiwari',    'Delhi Capitals', 'all_rounder',   1, 1000, 'Indian',        2025),
-- Bowlers
('Auqib Nabi',        'Delhi Capitals', 'bowler', 1, 1000, 'Indian',        2025),
('Dushmantha Chameera','Delhi Capitals','bowler', 1, 1000, 'Sri Lankan',    2025),
('Kyle Jamieson',     'Delhi Capitals', 'bowler', 1, 1000, 'New Zealander', 2025),
('Kuldeep Yadav',     'Delhi Capitals', 'bowler', 1, 1000, 'Indian',        2025),
('Mukesh Kumar',      'Delhi Capitals', 'bowler', 1, 1000, 'Indian',        2025),
('T Natarajan',       'Delhi Capitals', 'bowler', 1, 1000, 'Indian',        2025),
('Lungi Ngidi',       'Delhi Capitals', 'bowler', 1, 1000, 'South African', 2025),
('Vipraj Nigam',      'Delhi Capitals', 'bowler', 1, 1000, 'Indian',        2025),
('Mitchell Starc',    'Delhi Capitals', 'bowler', 1, 1000, 'Australian',    2025),
('Tripurana Vijay',   'Delhi Capitals', 'bowler', 1, 1000, 'Indian',        2025);

-- ============================================================
-- Gujarat Titans 2025 roster
-- ============================================================
DELETE FROM players WHERE ipl_team = 'Gujarat Titans';

INSERT INTO players (name, ipl_team, role, base_price, base_price_usd, nationality, ipl_season) VALUES
-- Batters
('Shubman Gill',      'Gujarat Titans', 'batsman',       1, 1000, 'Indian',        2025),
('Anuj Rawat',        'Gujarat Titans', 'wicket_keeper', 1, 1000, 'Indian',        2025),
('Tom Banton',        'Gujarat Titans', 'wicket_keeper', 1, 1000, 'English',       2025),
('Jos Buttler',       'Gujarat Titans', 'wicket_keeper', 1, 1000, 'English',       2025),
('Kumar Kushagra',    'Gujarat Titans', 'wicket_keeper', 1, 1000, 'Indian',        2025),
('Sai Sudharsan',     'Gujarat Titans', 'batsman',       1, 1000, 'Indian',        2025),
('M Shahrukh Khan',   'Gujarat Titans', 'batsman',       1, 1000, 'Indian',        2025),
-- All-rounders
('Jason Holder',      'Gujarat Titans', 'all_rounder',   1, 1000, 'West Indian',   2025),
('Glenn Phillips',    'Gujarat Titans', 'all_rounder',   1, 1000, 'New Zealander', 2025),
('Rashid Khan',       'Gujarat Titans', 'all_rounder',   1, 1000, 'Afghan',        2025),
('Nishant Sindhu',    'Gujarat Titans', 'all_rounder',   1, 1000, 'Indian',        2025),
('Manav Suthar',      'Gujarat Titans', 'all_rounder',   1, 1000, 'Indian',        2025),
('Rahul Tewatia',     'Gujarat Titans', 'all_rounder',   1, 1000, 'Indian',        2025),
('Washington Sundar', 'Gujarat Titans', 'all_rounder',   1, 1000, 'Indian',        2025),
-- Bowlers (Prithvi Raj excluded — withdrawn)
('Arshad Khan',       'Gujarat Titans', 'bowler', 1, 1000, 'Indian',        2025),
('Ashok Sharma',      'Gujarat Titans', 'bowler', 1, 1000, 'Indian',        2025),
('Gurnoor Brar',      'Gujarat Titans', 'bowler', 1, 1000, 'Indian',        2025),
('Kulwant Khejroliya','Gujarat Titans', 'bowler', 1, 1000, 'Indian',        2025),
('Mohammed Siraj',    'Gujarat Titans', 'bowler', 1, 1000, 'Indian',        2025),
('Prasidh Krishna',   'Gujarat Titans', 'bowler', 1, 1000, 'Indian',        2025),
('Kagiso Rabada',     'Gujarat Titans', 'bowler', 1, 1000, 'South African', 2025),
('Sai Kishore',       'Gujarat Titans', 'bowler', 1, 1000, 'Indian',        2025),
('Ishant Sharma',     'Gujarat Titans', 'bowler', 1, 1000, 'Indian',        2025),
('Luke Wood',         'Gujarat Titans', 'bowler', 1, 1000, 'English',       2025),
('Jayant Yadav',      'Gujarat Titans', 'bowler', 1, 1000, 'Indian',        2025);

-- ============================================================
-- Kolkata Knight Riders 2025 roster
-- ============================================================
DELETE FROM players WHERE ipl_team = 'Kolkata Knight Riders';

INSERT INTO players (name, ipl_team, role, base_price, base_price_usd, nationality, ipl_season) VALUES
-- Batters
('Ajinkya Rahane',       'Kolkata Knight Riders', 'batsman',       1, 1000, 'Indian',        2025),
('Rinku Singh',          'Kolkata Knight Riders', 'batsman',       1, 1000, 'Indian',        2025),
('Finn Allen',           'Kolkata Knight Riders', 'batsman',       1, 1000, 'New Zealander', 2025),
('Tejasvi Dahiya',       'Kolkata Knight Riders', 'wicket_keeper', 1, 1000, 'Indian',        2025),
('Manish Pandey',        'Kolkata Knight Riders', 'batsman',       1, 1000, 'Indian',        2025),
('Rovman Powell',        'Kolkata Knight Riders', 'batsman',       1, 1000, 'West Indian',   2025),
('Angkrish Raghuvanshi', 'Kolkata Knight Riders', 'batsman',       1, 1000, 'Indian',        2025),
('Ramandeep Singh',      'Kolkata Knight Riders', 'batsman',       1, 1000, 'Indian',        2025),
('Sarthak Ranjan',       'Kolkata Knight Riders', 'batsman',       1, 1000, 'Indian',        2025),
('Tim Seifert',          'Kolkata Knight Riders', 'wicket_keeper', 1, 1000, 'New Zealander', 2025),
('Rahul Tripathi',       'Kolkata Knight Riders', 'batsman',       1, 1000, 'Indian',        2025),
-- All-rounders
('Daksh Kamra',          'Kolkata Knight Riders', 'all_rounder',   1, 1000, 'Indian',        2025),
('Cameron Green',        'Kolkata Knight Riders', 'all_rounder',   1, 1000, 'Australian',    2025),
('Sunil Narine',         'Kolkata Knight Riders', 'all_rounder',   1, 1000, 'West Indian',   2025),
('Rachin Ravindra',      'Kolkata Knight Riders', 'all_rounder',   1, 1000, 'New Zealander', 2025),
('Anukul Roy',           'Kolkata Knight Riders', 'all_rounder',   1, 1000, 'Indian',        2025),
-- Bowlers (Akash Deep, Harshit Rana, Mustafizur Rahman excluded — withdrawn)
('Vaibhav Arora',        'Kolkata Knight Riders', 'bowler', 1, 1000, 'Indian',       2025),
('Saurabh Dubey',        'Kolkata Knight Riders', 'bowler', 1, 1000, 'Indian',       2025),
('Kartik Tyagi',         'Kolkata Knight Riders', 'bowler', 1, 1000, 'Indian',       2025),
('Blessing Muzarabani',  'Kolkata Knight Riders', 'bowler', 1, 1000, 'Zimbabwean',   2025),
('Matheesha Pathirana',  'Kolkata Knight Riders', 'bowler', 1, 1000, 'Sri Lankan',   2025),
('Navdeep Saini',        'Kolkata Knight Riders', 'bowler', 1, 1000, 'Indian',       2025),
('Prashant Solanki',     'Kolkata Knight Riders', 'bowler', 1, 1000, 'Indian',       2025),
('Umran Malik',          'Kolkata Knight Riders', 'bowler', 1, 1000, 'Indian',       2025),
('Varun Chakravarthy',   'Kolkata Knight Riders', 'bowler', 1, 1000, 'Indian',       2025);

-- ============================================================
-- Lucknow Super Giants 2025 roster
-- ============================================================
DELETE FROM players WHERE ipl_team = 'Lucknow Super Giants';

INSERT INTO players (name, ipl_team, role, base_price, base_price_usd, nationality, ipl_season) VALUES
-- Batters
('Rishabh Pant',        'Lucknow Super Giants', 'wicket_keeper', 1, 1000, 'Indian',        2025),
('Abdul Samad',         'Lucknow Super Giants', 'batsman',       1, 1000, 'Indian',        2025),
('Akshat Raghuwanshi',  'Lucknow Super Giants', 'batsman',       1, 1000, 'Indian',        2025),
('Ayush Badoni',        'Lucknow Super Giants', 'batsman',       1, 1000, 'Indian',        2025),
('Matthew Breetzke',    'Lucknow Super Giants', 'batsman',       1, 1000, 'South African', 2025),
('Mukul Choudhary',     'Lucknow Super Giants', 'batsman',       1, 1000, 'Indian',        2025),
('Himmat Singh',        'Lucknow Super Giants', 'batsman',       1, 1000, 'Indian',        2025),
('Josh Inglis',         'Lucknow Super Giants', 'wicket_keeper', 1, 1000, 'Australian',    2025),
('Aiden Markram',       'Lucknow Super Giants', 'batsman',       1, 1000, 'South African', 2025),
('Nicholas Pooran',     'Lucknow Super Giants', 'wicket_keeper', 1, 1000, 'West Indian',   2025),
-- All-rounders
('Wanindu Hasaranga',   'Lucknow Super Giants', 'all_rounder',   1, 1000, 'Sri Lankan',    2025),
('Arshin Kulkarni',     'Lucknow Super Giants', 'all_rounder',   1, 1000, 'Indian',        2025),
('Mitchell Marsh',      'Lucknow Super Giants', 'all_rounder',   1, 1000, 'Australian',    2025),
('Shahbaz Ahmed',       'Lucknow Super Giants', 'all_rounder',   1, 1000, 'Indian',        2025),
-- Bowlers
('Akash Singh',         'Lucknow Super Giants', 'bowler', 1, 1000, 'Indian',        2025),
('Avesh Khan',          'Lucknow Super Giants', 'bowler', 1, 1000, 'Indian',        2025),
('Mohammed Shami',      'Lucknow Super Giants', 'bowler', 1, 1000, 'Indian',        2025),
('Mohsin Khan',         'Lucknow Super Giants', 'bowler', 1, 1000, 'Indian',        2025),
('Anrich Nortje',       'Lucknow Super Giants', 'bowler', 1, 1000, 'South African', 2025),
('Prince Yadav',        'Lucknow Super Giants', 'bowler', 1, 1000, 'Indian',        2025),
('Digvesh Rathi',       'Lucknow Super Giants', 'bowler', 1, 1000, 'Indian',        2025),
('Manimaran Siddharth', 'Lucknow Super Giants', 'bowler', 1, 1000, 'Indian',        2025),
('Arjun Tendulkar',     'Lucknow Super Giants', 'bowler', 1, 1000, 'Indian',        2025),
('Naman Tiwari',        'Lucknow Super Giants', 'bowler', 1, 1000, 'Indian',        2025),
('Mayank Yadav',        'Lucknow Super Giants', 'bowler', 1, 1000, 'Indian',        2025);

-- ============================================================
-- Mumbai Indians 2025 roster
-- ============================================================
DELETE FROM players WHERE ipl_team = 'Mumbai Indians';

INSERT INTO players (name, ipl_team, role, base_price, base_price_usd, nationality, ipl_season) VALUES
-- Batters
('Quinton de Kock',    'Mumbai Indians', 'wicket_keeper', 1, 1000, 'South African', 2025),
('Danish Malewar',     'Mumbai Indians', 'batsman',       1, 1000, 'Indian',        2025),
('Robin Minz',         'Mumbai Indians', 'wicket_keeper', 1, 1000, 'Indian',        2025),
('Ryan Rickelton',     'Mumbai Indians', 'wicket_keeper', 1, 1000, 'South African', 2025),
('Sherfane Rutherford','Mumbai Indians', 'batsman',       1, 1000, 'West Indian',   2025),
('Rohit Sharma',       'Mumbai Indians', 'batsman',       1, 1000, 'Indian',        2025),
('Suryakumar Yadav',   'Mumbai Indians', 'batsman',       1, 1000, 'Indian',        2025),
-- All-rounders
('Hardik Pandya',      'Mumbai Indians', 'all_rounder',   1, 1000, 'Indian',        2025),
('Atharva Ankolekar',  'Mumbai Indians', 'all_rounder',   1, 1000, 'Indian',        2025),
('Raj Bawa',           'Mumbai Indians', 'all_rounder',   1, 1000, 'Indian',        2025),
('Corbin Bosch',       'Mumbai Indians', 'all_rounder',   1, 1000, 'South African', 2025),
('Will Jacks',         'Mumbai Indians', 'all_rounder',   1, 1000, 'English',       2025),
('Mayank Rawat',       'Mumbai Indians', 'all_rounder',   1, 1000, 'Indian',        2025),
('Naman Dhir',         'Mumbai Indians', 'all_rounder',   1, 1000, 'Indian',        2025),
('Mitchell Santner',   'Mumbai Indians', 'all_rounder',   1, 1000, 'New Zealander', 2025),
('Shardul Thakur',     'Mumbai Indians', 'all_rounder',   1, 1000, 'Indian',        2025),
('Tilak Varma',        'Mumbai Indians', 'all_rounder',   1, 1000, 'Indian',        2025),
-- Bowlers
('Ashwani Kumar',      'Mumbai Indians', 'bowler', 1, 1000, 'Indian',        2025),
('Trent Boult',        'Mumbai Indians', 'bowler', 1, 1000, 'New Zealander', 2025),
('Jasprit Bumrah',     'Mumbai Indians', 'bowler', 1, 1000, 'Indian',        2025),
('Deepak Chahar',      'Mumbai Indians', 'bowler', 1, 1000, 'Indian',        2025),
('AM Ghazanfar',       'Mumbai Indians', 'bowler', 1, 1000, 'Afghan',        2025),
('Mayank Markande',    'Mumbai Indians', 'bowler', 1, 1000, 'Indian',        2025),
('Mohd Izhar',         'Mumbai Indians', 'bowler', 1, 1000, 'Indian',        2025),
('Raghu Sharma',       'Mumbai Indians', 'bowler', 1, 1000, 'Indian',        2025);

-- ============================================================
-- Punjab Kings 2025 roster
-- ============================================================
DELETE FROM players WHERE ipl_team = 'Punjab Kings';

INSERT INTO players (name, ipl_team, role, base_price, base_price_usd, nationality, ipl_season) VALUES
-- Batters
('Shreyas Iyer',       'Punjab Kings', 'batsman',       1, 1000, 'Indian',        2025),
('Priyansh Arya',      'Punjab Kings', 'batsman',       1, 1000, 'Indian',        2025),
('Pyla Avinash',       'Punjab Kings', 'batsman',       1, 1000, 'Indian',        2025),
('Harnoor Singh',      'Punjab Kings', 'batsman',       1, 1000, 'Indian',        2025),
('Prabhsimran Singh',  'Punjab Kings', 'wicket_keeper', 1, 1000, 'Indian',        2025),
('Vishnu Vinod',       'Punjab Kings', 'wicket_keeper', 1, 1000, 'Indian',        2025),
('Nehal Wadhera',      'Punjab Kings', 'batsman',       1, 1000, 'Indian',        2025),
-- All-rounders
('Azmatullah Omarzai', 'Punjab Kings', 'all_rounder',   1, 1000, 'Afghan',        2025),
('Cooper Connolly',    'Punjab Kings', 'all_rounder',   1, 1000, 'Australian',    2025),
('Marco Jansen',       'Punjab Kings', 'all_rounder',   1, 1000, 'South African', 2025),
('Musheer Khan',       'Punjab Kings', 'all_rounder',   1, 1000, 'Indian',        2025),
('Mitchell Owen',      'Punjab Kings', 'all_rounder',   1, 1000, 'Australian',    2025),
('Shashank Singh',     'Punjab Kings', 'all_rounder',   1, 1000, 'Indian',        2025),
('Marcus Stoinis',     'Punjab Kings', 'all_rounder',   1, 1000, 'Australian',    2025),
('Suryansh Shedge',    'Punjab Kings', 'all_rounder',   1, 1000, 'Indian',        2025),
-- Bowlers
('Arshdeep Singh',     'Punjab Kings', 'bowler', 1, 1000, 'Indian',        2025),
('Xavier Bartlett',    'Punjab Kings', 'bowler', 1, 1000, 'Australian',    2025),
('Yuzvendra Chahal',   'Punjab Kings', 'bowler', 1, 1000, 'Indian',        2025),
('Praveen Dubey',      'Punjab Kings', 'bowler', 1, 1000, 'Indian',        2025),
('Ben Dwarshuis',      'Punjab Kings', 'bowler', 1, 1000, 'Australian',    2025),
('Lockie Ferguson',    'Punjab Kings', 'bowler', 1, 1000, 'New Zealander', 2025),
('Harpreet Brar',      'Punjab Kings', 'bowler', 1, 1000, 'Indian',        2025),
('Vishal Nishad',      'Punjab Kings', 'bowler', 1, 1000, 'Indian',        2025),
('Vijaykumar Vyshak',  'Punjab Kings', 'bowler', 1, 1000, 'Indian',        2025),
('Yash Thakur',        'Punjab Kings', 'bowler', 1, 1000, 'Indian',        2025);

-- ============================================================
-- Rajasthan Royals 2025 roster
-- ============================================================
DELETE FROM players WHERE ipl_team = 'Rajasthan Royals';

INSERT INTO players (name, ipl_team, role, base_price, base_price_usd, nationality, ipl_season) VALUES
-- Batters
('Riyan Parag',           'Rajasthan Royals', 'batsman',       1, 1000, 'Indian',        2025),
('Aman Rao',              'Rajasthan Royals', 'batsman',       1, 1000, 'Indian',        2025),
('Shubham Dubey',         'Rajasthan Royals', 'batsman',       1, 1000, 'Indian',        2025),
('Shimron Hetmyer',       'Rajasthan Royals', 'batsman',       1, 1000, 'West Indian',   2025),
('Yashasvi Jaiswal',      'Rajasthan Royals', 'batsman',       1, 1000, 'Indian',        2025),
('Dhruv Jurel',           'Rajasthan Royals', 'wicket_keeper', 1, 1000, 'Indian',        2025),
('Lhuan-dre Pretorius',   'Rajasthan Royals', 'wicket_keeper', 1, 1000, 'South African', 2025),
('Ravi Singh',            'Rajasthan Royals', 'batsman',       1, 1000, 'Indian',        2025),
('Vaibhav Sooryavanshi',  'Rajasthan Royals', 'batsman',       1, 1000, 'Indian',        2025),
-- All-rounders (Sam Curran excluded — withdrawn)
('Donovan Ferreira',      'Rajasthan Royals', 'all_rounder',   1, 1000, 'South African', 2025),
('Ravindra Jadeja',       'Rajasthan Royals', 'all_rounder',   1, 1000, 'Indian',        2025),
('Dasun Shanaka',         'Rajasthan Royals', 'all_rounder',   1, 1000, 'Sri Lankan',    2025),
-- Bowlers
('Jofra Archer',          'Rajasthan Royals', 'bowler', 1, 1000, 'English',       2025),
('Brijesh Sharma',        'Rajasthan Royals', 'bowler', 1, 1000, 'Indian',        2025),
('Nandre Burger',         'Rajasthan Royals', 'bowler', 1, 1000, 'South African', 2025),
('Tushar Deshpande',      'Rajasthan Royals', 'bowler', 1, 1000, 'Indian',        2025),
('Kwena Maphaka',         'Rajasthan Royals', 'bowler', 1, 1000, 'South African', 2025),
('Adam Milne',            'Rajasthan Royals', 'bowler', 1, 1000, 'New Zealander', 2025),
('Sushant Mishra',        'Rajasthan Royals', 'bowler', 1, 1000, 'Indian',        2025),
('Vignesh Puthur',        'Rajasthan Royals', 'bowler', 1, 1000, 'Indian',        2025),
('Ravi Bishnoi',          'Rajasthan Royals', 'bowler', 1, 1000, 'Indian',        2025),
('Sandeep Sharma',        'Rajasthan Royals', 'bowler', 1, 1000, 'Indian',        2025),
('Kuldeep Sen',           'Rajasthan Royals', 'bowler', 1, 1000, 'Indian',        2025),
('Yash Raj Punja',        'Rajasthan Royals', 'bowler', 1, 1000, 'Indian',        2025),
('Yudhvir Singh',         'Rajasthan Royals', 'bowler', 1, 1000, 'Indian',        2025);

-- ============================================================
-- Royal Challengers Bengaluru 2025 roster
-- ============================================================
DELETE FROM players WHERE ipl_team = 'Royal Challengers Bengaluru';

INSERT INTO players (name, ipl_team, role, base_price, base_price_usd, nationality, ipl_season) VALUES
-- Batters
('Rajat Patidar',    'Royal Challengers Bengaluru', 'batsman',       1, 1000, 'Indian',      2025),
('Jordan Cox',       'Royal Challengers Bengaluru', 'wicket_keeper', 1, 1000, 'English',     2025),
('Tim David',        'Royal Challengers Bengaluru', 'batsman',       1, 1000, 'Singaporean', 2025),
('Virat Kohli',      'Royal Challengers Bengaluru', 'batsman',       1, 1000, 'Indian',      2025),
('Devdutt Padikkal', 'Royal Challengers Bengaluru', 'batsman',       1, 1000, 'Indian',      2025),
('Phil Salt',        'Royal Challengers Bengaluru', 'wicket_keeper', 1, 1000, 'English',     2025),
('Jitesh Sharma',    'Royal Challengers Bengaluru', 'wicket_keeper', 1, 1000, 'Indian',      2025),
-- All-rounders
('Jacob Bethell',    'Royal Challengers Bengaluru', 'all_rounder',   1, 1000, 'English',     2025),
('Kanishk Chouhan',  'Royal Challengers Bengaluru', 'all_rounder',   1, 1000, 'Indian',      2025),
('Venkatesh Iyer',   'Royal Challengers Bengaluru', 'all_rounder',   1, 1000, 'Indian',      2025),
('Vihaan Malhotra',  'Royal Challengers Bengaluru', 'all_rounder',   1, 1000, 'Indian',      2025),
('Mangesh Yadav',    'Royal Challengers Bengaluru', 'all_rounder',   1, 1000, 'Indian',      2025),
('Krunal Pandya',    'Royal Challengers Bengaluru', 'all_rounder',   1, 1000, 'Indian',      2025),
('Romario Shepherd', 'Royal Challengers Bengaluru', 'all_rounder',   1, 1000, 'West Indian', 2025),
-- Bowlers (Yash Dayal excluded — withdrawn)
('Abhinandan Singh', 'Royal Challengers Bengaluru', 'bowler', 1, 1000, 'Indian',      2025),
('Satvik Deswal',    'Royal Challengers Bengaluru', 'bowler', 1, 1000, 'Indian',      2025),
('Jacob Duffy',      'Royal Challengers Bengaluru', 'bowler', 1, 1000, 'New Zealander',2025),
('Josh Hazlewood',   'Royal Challengers Bengaluru', 'bowler', 1, 1000, 'Australian',  2025),
('Bhuvneshwar Kumar','Royal Challengers Bengaluru', 'bowler', 1, 1000, 'Indian',      2025),
('Vicky Ostwal',     'Royal Challengers Bengaluru', 'bowler', 1, 1000, 'Indian',      2025),
('Rasikh Salam',     'Royal Challengers Bengaluru', 'bowler', 1, 1000, 'Indian',      2025),
('Suyash Sharma',    'Royal Challengers Bengaluru', 'bowler', 1, 1000, 'Indian',      2025),
('Swapnil Singh',    'Royal Challengers Bengaluru', 'bowler', 1, 1000, 'Indian',      2025),
('Nuwan Thushara',   'Royal Challengers Bengaluru', 'bowler', 1, 1000, 'Sri Lankan',  2025);

-- ============================================================
-- Sunrisers Hyderabad 2025 roster
-- ============================================================
DELETE FROM players WHERE ipl_team = 'Sunrisers Hyderabad';

INSERT INTO players (name, ipl_team, role, base_price, base_price_usd, nationality, ipl_season) VALUES
-- Batters
('Ishan Kishan',        'Sunrisers Hyderabad', 'wicket_keeper', 1, 1000, 'Indian',        2025),
('Salil Arora',         'Sunrisers Hyderabad', 'wicket_keeper', 1, 1000, 'Indian',        2025),
('Travis Head',         'Sunrisers Hyderabad', 'batsman',       1, 1000, 'Australian',    2025),
('Heinrich Klaasen',    'Sunrisers Hyderabad', 'wicket_keeper', 1, 1000, 'South African', 2025),
('Ravichandran Smaran', 'Sunrisers Hyderabad', 'batsman',       1, 1000, 'Indian',        2025),
('Aniket Verma',        'Sunrisers Hyderabad', 'batsman',       1, 1000, 'Indian',        2025),
-- All-rounders (Jack Edwards excluded — withdrawn)
('Abhishek Sharma',     'Sunrisers Hyderabad', 'all_rounder',   1, 1000, 'Indian',        2025),
('Brydon Carse',        'Sunrisers Hyderabad', 'all_rounder',   1, 1000, 'English',       2025),
('Harsh Dubey',         'Sunrisers Hyderabad', 'all_rounder',   1, 1000, 'Indian',        2025),
('Krains Fuletra',      'Sunrisers Hyderabad', 'all_rounder',   1, 1000, 'Indian',        2025),
('Liam Livingstone',    'Sunrisers Hyderabad', 'all_rounder',   1, 1000, 'English',       2025),
('Kamindu Mendis',      'Sunrisers Hyderabad', 'all_rounder',   1, 1000, 'Sri Lankan',    2025),
('Nitish Kumar Reddy',  'Sunrisers Hyderabad', 'all_rounder',   1, 1000, 'Indian',        2025),
('Harshal Patel',       'Sunrisers Hyderabad', 'all_rounder',   1, 1000, 'Indian',        2025),
('Shivam Mavi',         'Sunrisers Hyderabad', 'all_rounder',   1, 1000, 'Indian',        2025),
('Shivang Kumar',       'Sunrisers Hyderabad', 'all_rounder',   1, 1000, 'Indian',        2025),
-- Bowlers
('Amit Kumar',          'Sunrisers Hyderabad', 'bowler', 1, 1000, 'Indian',     2025),
('Pat Cummins',         'Sunrisers Hyderabad', 'bowler', 1, 1000, 'Australian', 2025),
('Praful Hinge',        'Sunrisers Hyderabad', 'bowler', 1, 1000, 'Indian',     2025),
('Eshan Malinga',       'Sunrisers Hyderabad', 'bowler', 1, 1000, 'Sri Lankan', 2025),
('David Payne',         'Sunrisers Hyderabad', 'bowler', 1, 1000, 'English',    2025),
('Sakib Hussain',       'Sunrisers Hyderabad', 'bowler', 1, 1000, 'Indian',     2025),
('Onkar Tarmale',       'Sunrisers Hyderabad', 'bowler', 1, 1000, 'Indian',     2025),
('Jaydev Unadkat',      'Sunrisers Hyderabad', 'bowler', 1, 1000, 'Indian',     2025),
('Zeeshan Ansari',      'Sunrisers Hyderabad', 'bowler', 1, 1000, 'Indian',     2025);
