-- ============================================================
-- 003_seed_players.sql — IPL 2025 Player Seed Data (~250 players)
-- ============================================================

INSERT INTO players (name, ipl_team, role, base_price, nationality, ipl_season) VALUES

-- ============================================================
-- Mumbai Indians (MI)
-- ============================================================
('Rohit Sharma', 'Mumbai Indians', 'batsman', 1000, 'Indian', 2025),
('Jasprit Bumrah', 'Mumbai Indians', 'bowler', 1000, 'Indian', 2025),
('Suryakumar Yadav', 'Mumbai Indians', 'batsman', 800, 'Indian', 2025),
('Hardik Pandya', 'Mumbai Indians', 'all_rounder', 800, 'Indian', 2025),
('Ishan Kishan', 'Mumbai Indians', 'wicket_keeper', 600, 'Indian', 2025),
('Tilak Varma', 'Mumbai Indians', 'batsman', 400, 'Indian', 2025),
('Tim David', 'Mumbai Indians', 'batsman', 400, 'Singaporean', 2025),
('Gerald Coetzee', 'Mumbai Indians', 'bowler', 300, 'South African', 2025),
('Trent Boult', 'Mumbai Indians', 'bowler', 600, 'New Zealander', 2025),
('Nuwan Thushara', 'Mumbai Indians', 'bowler', 200, 'Sri Lankan', 2025),
('Naman Dhir', 'Mumbai Indians', 'all_rounder', 200, 'Indian', 2025),
('Piyush Chawla', 'Mumbai Indians', 'bowler', 200, 'Indian', 2025),
('Shreyas Gopal', 'Mumbai Indians', 'bowler', 200, 'Indian', 2025),
('Romario Shepherd', 'Mumbai Indians', 'all_rounder', 300, 'West Indian', 2025),
('Dewald Brevis', 'Mumbai Indians', 'batsman', 300, 'South African', 2025),

-- ============================================================
-- Chennai Super Kings (CSK)
-- ============================================================
('MS Dhoni', 'Chennai Super Kings', 'wicket_keeper', 1000, 'Indian', 2025),
('Ruturaj Gaikwad', 'Chennai Super Kings', 'batsman', 600, 'Indian', 2025),
('Ravindra Jadeja', 'Chennai Super Kings', 'all_rounder', 800, 'Indian', 2025),
('Devon Conway', 'Chennai Super Kings', 'wicket_keeper', 400, 'New Zealander', 2025),
('Shivam Dube', 'Chennai Super Kings', 'all_rounder', 400, 'Indian', 2025),
('Deepak Chahar', 'Chennai Super Kings', 'bowler', 400, 'Indian', 2025),
('Tushar Deshpande', 'Chennai Super Kings', 'bowler', 200, 'Indian', 2025),
('Matheesha Pathirana', 'Chennai Super Kings', 'bowler', 300, 'Sri Lankan', 2025),
('Moeen Ali', 'Chennai Super Kings', 'all_rounder', 400, 'English', 2025),
('Ajinkya Rahane', 'Chennai Super Kings', 'batsman', 200, 'Indian', 2025),
('Shardul Thakur', 'Chennai Super Kings', 'all_rounder', 300, 'Indian', 2025),
('Rachin Ravindra', 'Chennai Super Kings', 'all_rounder', 400, 'New Zealander', 2025),
('Sameer Rizvi', 'Chennai Super Kings', 'batsman', 200, 'Indian', 2025),
('Mustafizur Rahman', 'Chennai Super Kings', 'bowler', 300, 'Bangladeshi', 2025),
('Mukesh Choudhary', 'Chennai Super Kings', 'bowler', 200, 'Indian', 2025),

-- ============================================================
-- Royal Challengers Bengaluru (RCB)
-- ============================================================
('Virat Kohli', 'Royal Challengers Bengaluru', 'batsman', 1000, 'Indian', 2025),
('Faf du Plessis', 'Royal Challengers Bengaluru', 'batsman', 400, 'South African', 2025),
('Glenn Maxwell', 'Royal Challengers Bengaluru', 'all_rounder', 600, 'Australian', 2025),
('Mohammad Siraj', 'Royal Challengers Bengaluru', 'bowler', 400, 'Indian', 2025),
('Dinesh Karthik', 'Royal Challengers Bengaluru', 'wicket_keeper', 400, 'Indian', 2025),
('Rajat Patidar', 'Royal Challengers Bengaluru', 'batsman', 300, 'Indian', 2025),
('Anuj Rawat', 'Royal Challengers Bengaluru', 'wicket_keeper', 200, 'Indian', 2025),
('Alzarri Joseph', 'Royal Challengers Bengaluru', 'bowler', 300, 'West Indian', 2025),
('Lockie Ferguson', 'Royal Challengers Bengaluru', 'bowler', 300, 'New Zealander', 2025),
('Will Jacks', 'Royal Challengers Bengaluru', 'all_rounder', 400, 'English', 2025),
('Swapnil Singh', 'Royal Challengers Bengaluru', 'all_rounder', 200, 'Indian', 2025),
('Karn Sharma', 'Royal Challengers Bengaluru', 'bowler', 200, 'Indian', 2025),
('Yash Dayal', 'Royal Challengers Bengaluru', 'bowler', 200, 'Indian', 2025),
('Tom Curran', 'Royal Challengers Bengaluru', 'all_rounder', 200, 'English', 2025),
('Cameron Green', 'Royal Challengers Bengaluru', 'all_rounder', 600, 'Australian', 2025),

-- ============================================================
-- Kolkata Knight Riders (KKR)
-- ============================================================
('Shreyas Iyer', 'Kolkata Knight Riders', 'batsman', 600, 'Indian', 2025),
('Andre Russell', 'Kolkata Knight Riders', 'all_rounder', 600, 'West Indian', 2025),
('Sunil Narine', 'Kolkata Knight Riders', 'all_rounder', 600, 'West Indian', 2025),
('Nitish Rana', 'Kolkata Knight Riders', 'batsman', 400, 'Indian', 2025),
('Rinku Singh', 'Kolkata Knight Riders', 'batsman', 400, 'Indian', 2025),
('Venkatesh Iyer', 'Kolkata Knight Riders', 'all_rounder', 400, 'Indian', 2025),
('Mitchell Starc', 'Kolkata Knight Riders', 'bowler', 800, 'Australian', 2025),
('Varun Chakravarthy', 'Kolkata Knight Riders', 'bowler', 400, 'Indian', 2025),
('Phil Salt', 'Kolkata Knight Riders', 'wicket_keeper', 400, 'English', 2025),
('Angkrish Raghuvanshi', 'Kolkata Knight Riders', 'batsman', 200, 'Indian', 2025),
('Harshit Rana', 'Kolkata Knight Riders', 'bowler', 200, 'Indian', 2025),
('Suyash Sharma', 'Kolkata Knight Riders', 'bowler', 200, 'Indian', 2025),
('Ramandeep Singh', 'Kolkata Knight Riders', 'all_rounder', 200, 'Indian', 2025),
('Manish Pandey', 'Kolkata Knight Riders', 'batsman', 200, 'Indian', 2025),
('Spencer Johnson', 'Kolkata Knight Riders', 'bowler', 300, 'Australian', 2025),

-- ============================================================
-- Delhi Capitals (DC)
-- ============================================================
('David Warner', 'Delhi Capitals', 'batsman', 600, 'Australian', 2025),
('Rishabh Pant', 'Delhi Capitals', 'wicket_keeper', 800, 'Indian', 2025),
('Axar Patel', 'Delhi Capitals', 'all_rounder', 600, 'Indian', 2025),
('Kuldeep Yadav', 'Delhi Capitals', 'bowler', 600, 'Indian', 2025),
('Jake Fraser-McGurk', 'Delhi Capitals', 'batsman', 300, 'Australian', 2025),
('Tristan Stubbs', 'Delhi Capitals', 'batsman', 200, 'South African', 2025),
('Abishek Porel', 'Delhi Capitals', 'wicket_keeper', 200, 'Indian', 2025),
('Anrich Nortje', 'Delhi Capitals', 'bowler', 400, 'South African', 2025),
('Ishant Sharma', 'Delhi Capitals', 'bowler', 200, 'Indian', 2025),
('Mitchell Marsh', 'Delhi Capitals', 'all_rounder', 600, 'Australian', 2025),
('Shai Hope', 'Delhi Capitals', 'wicket_keeper', 300, 'West Indian', 2025),
('Jhye Richardson', 'Delhi Capitals', 'bowler', 300, 'Australian', 2025),
('Sumit Kumar', 'Delhi Capitals', 'bowler', 200, 'Indian', 2025),
('Ricky Bhui', 'Delhi Capitals', 'batsman', 200, 'Indian', 2025),
('Kumar Kushagra', 'Delhi Capitals', 'wicket_keeper', 200, 'Indian', 2025),

-- ============================================================
-- Rajasthan Royals (RR)
-- ============================================================
('Sanju Samson', 'Rajasthan Royals', 'wicket_keeper', 600, 'Indian', 2025),
('Jos Buttler', 'Rajasthan Royals', 'wicket_keeper', 800, 'English', 2025),
('Shimron Hetmyer', 'Rajasthan Royals', 'batsman', 400, 'West Indian', 2025),
('Ravichandran Ashwin', 'Rajasthan Royals', 'all_rounder', 600, 'Indian', 2025),
('Yuzvendra Chahal', 'Rajasthan Royals', 'bowler', 600, 'Indian', 2025),
('Trent Boult', 'Rajasthan Royals', 'bowler', 600, 'New Zealander', 2025),
('Riyan Parag', 'Rajasthan Royals', 'batsman', 200, 'Indian', 2025),
('Dhruv Jurel', 'Rajasthan Royals', 'wicket_keeper', 200, 'Indian', 2025),
('Yashasvi Jaiswal', 'Rajasthan Royals', 'batsman', 600, 'Indian', 2025),
('Avesh Khan', 'Rajasthan Royals', 'bowler', 400, 'Indian', 2025),
('Sandeep Sharma', 'Rajasthan Royals', 'bowler', 200, 'Indian', 2025),
('Tom Kohler-Cadmore', 'Rajasthan Royals', 'batsman', 200, 'English', 2025),
('Kunal Rathore', 'Rajasthan Royals', 'wicket_keeper', 200, 'Indian', 2025),
('Navdeep Saini', 'Rajasthan Royals', 'bowler', 200, 'Indian', 2025),
('Rovman Powell', 'Rajasthan Royals', 'batsman', 400, 'West Indian', 2025),

-- ============================================================
-- Punjab Kings (PBKS)
-- ============================================================
('Shikhar Dhawan', 'Punjab Kings', 'batsman', 400, 'Indian', 2025),
('Liam Livingstone', 'Punjab Kings', 'all_rounder', 600, 'English', 2025),
('Sam Curran', 'Punjab Kings', 'all_rounder', 600, 'English', 2025),
('Arshdeep Singh', 'Punjab Kings', 'bowler', 400, 'Indian', 2025),
('Jonny Bairstow', 'Punjab Kings', 'wicket_keeper', 400, 'English', 2025),
('Kagiso Rabada', 'Punjab Kings', 'bowler', 600, 'South African', 2025),
('Harpreet Brar', 'Punjab Kings', 'all_rounder', 200, 'Indian', 2025),
('Prabhsimran Singh', 'Punjab Kings', 'wicket_keeper', 200, 'Indian', 2025),
('Atharva Taide', 'Punjab Kings', 'batsman', 200, 'Indian', 2025),
('Nathan Ellis', 'Punjab Kings', 'bowler', 300, 'Australian', 2025),
('Rilee Rossouw', 'Punjab Kings', 'batsman', 300, 'South African', 2025),
('Harshal Patel', 'Punjab Kings', 'bowler', 400, 'Indian', 2025),
('Rahul Chahar', 'Punjab Kings', 'bowler', 200, 'Indian', 2025),
('Shashank Singh', 'Punjab Kings', 'batsman', 200, 'Indian', 2025),
('Chris Woakes', 'Punjab Kings', 'all_rounder', 400, 'English', 2025),

-- ============================================================
-- Sunrisers Hyderabad (SRH)
-- ============================================================
('Pat Cummins', 'Sunrisers Hyderabad', 'all_rounder', 800, 'Australian', 2025),
('Heinrich Klaasen', 'Sunrisers Hyderabad', 'wicket_keeper', 600, 'South African', 2025),
('Travis Head', 'Sunrisers Hyderabad', 'batsman', 600, 'Australian', 2025),
('Abhishek Sharma', 'Sunrisers Hyderabad', 'all_rounder', 400, 'Indian', 2025),
('Nitish Kumar Reddy', 'Sunrisers Hyderabad', 'all_rounder', 200, 'Indian', 2025),
('Bhuvneshwar Kumar', 'Sunrisers Hyderabad', 'bowler', 400, 'Indian', 2025),
('Mayank Agarwal', 'Sunrisers Hyderabad', 'batsman', 300, 'Indian', 2025),
('Washington Sundar', 'Sunrisers Hyderabad', 'all_rounder', 400, 'Indian', 2025),
('T Natarajan', 'Sunrisers Hyderabad', 'bowler', 300, 'Indian', 2025),
('Shahbaz Ahmed', 'Sunrisers Hyderabad', 'all_rounder', 200, 'Indian', 2025),
('Jaydev Unadkat', 'Sunrisers Hyderabad', 'bowler', 200, 'Indian', 2025),
('Akeal Hosein', 'Sunrisers Hyderabad', 'bowler', 200, 'West Indian', 2025),
('Adam Zampa', 'Sunrisers Hyderabad', 'bowler', 300, 'Australian', 2025),
('Rahul Tripathi', 'Sunrisers Hyderabad', 'batsman', 300, 'Indian', 2025),
('Aiden Markram', 'Sunrisers Hyderabad', 'batsman', 400, 'South African', 2025),

-- ============================================================
-- Gujarat Titans (GT)
-- ============================================================
('Shubman Gill', 'Gujarat Titans', 'batsman', 800, 'Indian', 2025),
('Mohit Sharma', 'Gujarat Titans', 'bowler', 400, 'Indian', 2025),
('Rashid Khan', 'Gujarat Titans', 'all_rounder', 800, 'Afghan', 2025),
('David Miller', 'Gujarat Titans', 'batsman', 400, 'South African', 2025),
('Wriddhiman Saha', 'Gujarat Titans', 'wicket_keeper', 400, 'Indian', 2025),
('Vijay Shankar', 'Gujarat Titans', 'all_rounder', 300, 'Indian', 2025),
('Azmatullah Omarzai', 'Gujarat Titans', 'all_rounder', 200, 'Afghan', 2025),
('Darshan Nalkande', 'Gujarat Titans', 'bowler', 200, 'Indian', 2025),
('Kane Williamson', 'Gujarat Titans', 'batsman', 600, 'New Zealander', 2025),
('Josh Little', 'Gujarat Titans', 'bowler', 300, 'Irish', 2025),
('Sai Kishore', 'Gujarat Titans', 'bowler', 200, 'Indian', 2025),
('Noor Ahmad', 'Gujarat Titans', 'bowler', 300, 'Afghan', 2025),
('Shahrukh Khan', 'Gujarat Titans', 'batsman', 200, 'Indian', 2025),
('Spencer Johnson', 'Gujarat Titans', 'bowler', 300, 'Australian', 2025),
('Matthew Wade', 'Gujarat Titans', 'wicket_keeper', 200, 'Australian', 2025),

-- ============================================================
-- Lucknow Super Giants (LSG)
-- ============================================================
('KL Rahul', 'Lucknow Super Giants', 'wicket_keeper', 800, 'Indian', 2025),
('Nicholas Pooran', 'Lucknow Super Giants', 'wicket_keeper', 600, 'West Indian', 2025),
('Marcus Stoinis', 'Lucknow Super Giants', 'all_rounder', 400, 'Australian', 2025),
('Mark Wood', 'Lucknow Super Giants', 'bowler', 600, 'English', 2025),
('Ravi Bishnoi', 'Lucknow Super Giants', 'bowler', 400, 'Indian', 2025),
('Deepak Hooda', 'Lucknow Super Giants', 'all_rounder', 300, 'Indian', 2025),
('Quinton de Kock', 'Lucknow Super Giants', 'wicket_keeper', 600, 'South African', 2025),
('Kyle Mayers', 'Lucknow Super Giants', 'all_rounder', 300, 'West Indian', 2025),
('Yash Thakur', 'Lucknow Super Giants', 'bowler', 200, 'Indian', 2025),
('Ayush Badoni', 'Lucknow Super Giants', 'batsman', 200, 'Indian', 2025),
('Mohsin Khan', 'Lucknow Super Giants', 'bowler', 200, 'Indian', 2025),
('Krunal Pandya', 'Lucknow Super Giants', 'all_rounder', 400, 'Indian', 2025),
('Prerak Mankad', 'Lucknow Super Giants', 'batsman', 200, 'Indian', 2025),
('Aryan Juyal', 'Lucknow Super Giants', 'wicket_keeper', 200, 'Indian', 2025),
('Matt Henry', 'Lucknow Super Giants', 'bowler', 300, 'New Zealander', 2025)

ON CONFLICT DO NOTHING;
