-- ============================================================
-- 013_ipl2026_schedule.sql
-- Adds match_number, season_year, start_time_utc to ipl_matches
-- Updates ipl_weeks to 2026 dates
-- Seeds all 70 IPL 2026 league matches
-- ============================================================

-- 1. Add new columns to ipl_matches
ALTER TABLE ipl_matches
  ADD COLUMN IF NOT EXISTS match_number  INTEGER,
  ADD COLUMN IF NOT EXISTS season_year   INTEGER NOT NULL DEFAULT 2026,
  ADD COLUMN IF NOT EXISTS start_time_utc TIMESTAMPTZ;

-- 2. Update ipl_weeks to 2026 dates
-- Week boundaries follow Saturday-Friday calendar
UPDATE ipl_weeks SET
  start_date = '2026-03-28', end_date = '2026-04-03',
  lock_time  = '2026-03-28 14:00:00+00'
WHERE week_num = 1;

UPDATE ipl_weeks SET
  start_date = '2026-04-04', end_date = '2026-04-10',
  lock_time  = '2026-04-04 10:00:00+00'
WHERE week_num = 2;

UPDATE ipl_weeks SET
  start_date = '2026-04-11', end_date = '2026-04-17',
  lock_time  = '2026-04-11 10:00:00+00'
WHERE week_num = 3;

UPDATE ipl_weeks SET
  start_date = '2026-04-18', end_date = '2026-04-24',
  lock_time  = '2026-04-18 10:00:00+00'
WHERE week_num = 4;

UPDATE ipl_weeks SET
  start_date = '2026-04-25', end_date = '2026-05-01',
  lock_time  = '2026-04-25 10:00:00+00'
WHERE week_num = 5;

UPDATE ipl_weeks SET
  start_date = '2026-05-02', end_date = '2026-05-08',
  lock_time  = '2026-05-02 14:00:00+00'
WHERE week_num = 6;

UPDATE ipl_weeks SET
  start_date = '2026-05-09', end_date = '2026-05-15',
  lock_time  = '2026-05-09 14:00:00+00'
WHERE week_num = 7;

UPDATE ipl_weeks SET
  start_date = '2026-05-16', end_date = '2026-05-22',
  lock_time  = '2026-05-16 14:00:00+00'
WHERE week_num = 8;

UPDATE ipl_weeks SET
  label      = 'Final Round',
  start_date = '2026-05-23', end_date = '2026-05-24',
  lock_time  = '2026-05-23 14:00:00+00'
WHERE week_num = 9;

UPDATE ipl_weeks SET
  label      = 'Playoffs',
  start_date = '2026-05-26', end_date = '2026-06-05',
  lock_time  = '2026-05-26 14:00:00+00'
WHERE week_num = 10;

-- 3. Insert all 70 IPL 2026 league matches
-- start_time_utc: 7:30 PM IST = 14:00 UTC, 3:30 PM IST = 10:00 UTC
-- match_id format: IPL2026-NNN

INSERT INTO ipl_matches (match_id, match_number, season_year, home_team, away_team, match_date, start_time_utc, week_num, venue) VALUES
-- WEEK 1 (Mar 28 – Apr 3)
('IPL2026-001',  1, 2026, 'Royal Challengers Bengaluru', 'Sunrisers Hyderabad',  '2026-03-28', '2026-03-28 14:00:00+00', 1, 'Bengaluru'),
('IPL2026-002',  2, 2026, 'Mumbai Indians',               'Kolkata Knight Riders','2026-03-29', '2026-03-29 14:00:00+00', 1, 'Mumbai'),
('IPL2026-003',  3, 2026, 'Rajasthan Royals',             'Chennai Super Kings',  '2026-03-30', '2026-03-30 14:00:00+00', 1, 'Guwahati'),
('IPL2026-004',  4, 2026, 'Punjab Kings',                 'Gujarat Titans',       '2026-03-31', '2026-03-31 14:00:00+00', 1, 'New Chandigarh'),
('IPL2026-005',  5, 2026, 'Lucknow Super Giants',         'Delhi Capitals',       '2026-04-01', '2026-04-01 14:00:00+00', 1, 'Lucknow'),
('IPL2026-006',  6, 2026, 'Kolkata Knight Riders',        'Sunrisers Hyderabad',  '2026-04-02', '2026-04-02 14:00:00+00', 1, 'Kolkata'),
('IPL2026-007',  7, 2026, 'Chennai Super Kings',          'Punjab Kings',         '2026-04-03', '2026-04-03 14:00:00+00', 1, 'Chennai'),

-- WEEK 2 (Apr 4 – Apr 10)
('IPL2026-008',  8, 2026, 'Delhi Capitals',               'Mumbai Indians',       '2026-04-04', '2026-04-04 10:00:00+00', 2, 'Delhi'),
('IPL2026-009',  9, 2026, 'Gujarat Titans',               'Rajasthan Royals',     '2026-04-04', '2026-04-04 14:00:00+00', 2, 'Ahmedabad'),
('IPL2026-010', 10, 2026, 'Sunrisers Hyderabad',          'Lucknow Super Giants', '2026-04-05', '2026-04-05 10:00:00+00', 2, 'Hyderabad'),
('IPL2026-011', 11, 2026, 'Royal Challengers Bengaluru',  'Chennai Super Kings',  '2026-04-05', '2026-04-05 14:00:00+00', 2, 'Bengaluru'),
('IPL2026-012', 12, 2026, 'Kolkata Knight Riders',        'Punjab Kings',         '2026-04-06', '2026-04-06 14:00:00+00', 2, 'Kolkata'),
('IPL2026-013', 13, 2026, 'Rajasthan Royals',             'Mumbai Indians',       '2026-04-07', '2026-04-07 14:00:00+00', 2, 'Guwahati'),
('IPL2026-014', 14, 2026, 'Delhi Capitals',               'Gujarat Titans',       '2026-04-08', '2026-04-08 14:00:00+00', 2, 'Delhi'),
('IPL2026-015', 15, 2026, 'Kolkata Knight Riders',        'Lucknow Super Giants', '2026-04-09', '2026-04-09 14:00:00+00', 2, 'Kolkata'),
('IPL2026-016', 16, 2026, 'Rajasthan Royals',             'Royal Challengers Bengaluru','2026-04-10','2026-04-10 14:00:00+00', 2, 'Guwahati'),

-- WEEK 3 (Apr 11 – Apr 17)
('IPL2026-017', 17, 2026, 'Punjab Kings',                 'Sunrisers Hyderabad',  '2026-04-11', '2026-04-11 10:00:00+00', 3, 'New Chandigarh'),
('IPL2026-018', 18, 2026, 'Chennai Super Kings',          'Delhi Capitals',       '2026-04-11', '2026-04-11 14:00:00+00', 3, 'Chennai'),
('IPL2026-019', 19, 2026, 'Lucknow Super Giants',         'Gujarat Titans',       '2026-04-12', '2026-04-12 10:00:00+00', 3, 'Lucknow'),
('IPL2026-020', 20, 2026, 'Mumbai Indians',               'Royal Challengers Bengaluru','2026-04-12','2026-04-12 14:00:00+00', 3, 'Mumbai'),
('IPL2026-021', 21, 2026, 'Sunrisers Hyderabad',          'Rajasthan Royals',     '2026-04-13', '2026-04-13 14:00:00+00', 3, 'Hyderabad'),
('IPL2026-022', 22, 2026, 'Chennai Super Kings',          'Kolkata Knight Riders','2026-04-14', '2026-04-14 14:00:00+00', 3, 'Chennai'),
('IPL2026-023', 23, 2026, 'Royal Challengers Bengaluru',  'Lucknow Super Giants', '2026-04-15', '2026-04-15 14:00:00+00', 3, 'Bengaluru'),
('IPL2026-024', 24, 2026, 'Mumbai Indians',               'Punjab Kings',         '2026-04-16', '2026-04-16 14:00:00+00', 3, 'Mumbai'),
('IPL2026-025', 25, 2026, 'Gujarat Titans',               'Kolkata Knight Riders','2026-04-17', '2026-04-17 14:00:00+00', 3, 'Ahmedabad'),

-- WEEK 4 (Apr 18 – Apr 24)
('IPL2026-026', 26, 2026, 'Royal Challengers Bengaluru',  'Delhi Capitals',       '2026-04-18', '2026-04-18 10:00:00+00', 4, 'Bengaluru'),
('IPL2026-027', 27, 2026, 'Sunrisers Hyderabad',          'Chennai Super Kings',  '2026-04-18', '2026-04-18 14:00:00+00', 4, 'Hyderabad'),
('IPL2026-028', 28, 2026, 'Kolkata Knight Riders',        'Rajasthan Royals',     '2026-04-19', '2026-04-19 10:00:00+00', 4, 'Kolkata'),
('IPL2026-029', 29, 2026, 'Punjab Kings',                 'Lucknow Super Giants', '2026-04-19', '2026-04-19 14:00:00+00', 4, 'New Chandigarh'),
('IPL2026-030', 30, 2026, 'Gujarat Titans',               'Mumbai Indians',       '2026-04-20', '2026-04-20 14:00:00+00', 4, 'Ahmedabad'),
('IPL2026-031', 31, 2026, 'Sunrisers Hyderabad',          'Delhi Capitals',       '2026-04-21', '2026-04-21 14:00:00+00', 4, 'Hyderabad'),
('IPL2026-032', 32, 2026, 'Lucknow Super Giants',         'Rajasthan Royals',     '2026-04-22', '2026-04-22 14:00:00+00', 4, 'Lucknow'),
('IPL2026-033', 33, 2026, 'Mumbai Indians',               'Chennai Super Kings',  '2026-04-23', '2026-04-23 14:00:00+00', 4, 'Mumbai'),
('IPL2026-034', 34, 2026, 'Royal Challengers Bengaluru',  'Gujarat Titans',       '2026-04-24', '2026-04-24 14:00:00+00', 4, 'Bengaluru'),

-- WEEK 5 (Apr 25 – May 1)
('IPL2026-035', 35, 2026, 'Delhi Capitals',               'Punjab Kings',         '2026-04-25', '2026-04-25 10:00:00+00', 5, 'Delhi'),
('IPL2026-036', 36, 2026, 'Rajasthan Royals',             'Sunrisers Hyderabad',  '2026-04-25', '2026-04-25 14:00:00+00', 5, 'Jaipur'),
('IPL2026-037', 37, 2026, 'Gujarat Titans',               'Chennai Super Kings',  '2026-04-26', '2026-04-26 10:00:00+00', 5, 'Ahmedabad'),
('IPL2026-038', 38, 2026, 'Lucknow Super Giants',         'Kolkata Knight Riders','2026-04-26', '2026-04-26 14:00:00+00', 5, 'Lucknow'),
('IPL2026-039', 39, 2026, 'Delhi Capitals',               'Royal Challengers Bengaluru','2026-04-27','2026-04-27 14:00:00+00', 5, 'Delhi'),
('IPL2026-040', 40, 2026, 'Punjab Kings',                 'Rajasthan Royals',     '2026-04-28', '2026-04-28 14:00:00+00', 5, 'New Chandigarh'),
('IPL2026-041', 41, 2026, 'Mumbai Indians',               'Sunrisers Hyderabad',  '2026-04-29', '2026-04-29 14:00:00+00', 5, 'Mumbai'),
('IPL2026-042', 42, 2026, 'Gujarat Titans',               'Royal Challengers Bengaluru','2026-04-30','2026-04-30 14:00:00+00', 5, 'Ahmedabad'),
('IPL2026-043', 43, 2026, 'Rajasthan Royals',             'Delhi Capitals',       '2026-05-01', '2026-05-01 14:00:00+00', 5, 'Jaipur'),

-- WEEK 6 (May 2 – May 8)
('IPL2026-044', 44, 2026, 'Chennai Super Kings',          'Mumbai Indians',       '2026-05-02', '2026-05-02 14:00:00+00', 6, 'Chennai'),
('IPL2026-045', 45, 2026, 'Sunrisers Hyderabad',          'Kolkata Knight Riders','2026-05-03', '2026-05-03 10:00:00+00', 6, 'Hyderabad'),
('IPL2026-046', 46, 2026, 'Gujarat Titans',               'Punjab Kings',         '2026-05-03', '2026-05-03 14:00:00+00', 6, 'Ahmedabad'),
('IPL2026-047', 47, 2026, 'Mumbai Indians',               'Lucknow Super Giants', '2026-05-04', '2026-05-04 14:00:00+00', 6, 'Mumbai'),
('IPL2026-048', 48, 2026, 'Delhi Capitals',               'Chennai Super Kings',  '2026-05-05', '2026-05-05 14:00:00+00', 6, 'Delhi'),
('IPL2026-049', 49, 2026, 'Sunrisers Hyderabad',          'Punjab Kings',         '2026-05-06', '2026-05-06 14:00:00+00', 6, 'Hyderabad'),
('IPL2026-050', 50, 2026, 'Lucknow Super Giants',         'Royal Challengers Bengaluru','2026-05-07','2026-05-07 14:00:00+00', 6, 'Lucknow'),
('IPL2026-051', 51, 2026, 'Delhi Capitals',               'Kolkata Knight Riders','2026-05-08', '2026-05-08 14:00:00+00', 6, 'Delhi'),

-- WEEK 7 (May 9 – May 15)
('IPL2026-052', 52, 2026, 'Rajasthan Royals',             'Gujarat Titans',       '2026-05-09', '2026-05-09 14:00:00+00', 7, 'Jaipur'),
('IPL2026-053', 53, 2026, 'Chennai Super Kings',          'Lucknow Super Giants', '2026-05-10', '2026-05-10 10:00:00+00', 7, 'Chennai'),
('IPL2026-054', 54, 2026, 'Royal Challengers Bengaluru',  'Mumbai Indians',       '2026-05-10', '2026-05-10 14:00:00+00', 7, 'Raipur'),
('IPL2026-055', 55, 2026, 'Punjab Kings',                 'Delhi Capitals',       '2026-05-11', '2026-05-11 14:00:00+00', 7, 'Dharamshala'),
('IPL2026-056', 56, 2026, 'Gujarat Titans',               'Sunrisers Hyderabad',  '2026-05-12', '2026-05-12 14:00:00+00', 7, 'Ahmedabad'),
('IPL2026-057', 57, 2026, 'Royal Challengers Bengaluru',  'Kolkata Knight Riders','2026-05-13', '2026-05-13 14:00:00+00', 7, 'Raipur'),
('IPL2026-058', 58, 2026, 'Punjab Kings',                 'Mumbai Indians',       '2026-05-14', '2026-05-14 14:00:00+00', 7, 'Dharamshala'),
('IPL2026-059', 59, 2026, 'Lucknow Super Giants',         'Chennai Super Kings',  '2026-05-15', '2026-05-15 14:00:00+00', 7, 'Lucknow'),

-- WEEK 8 (May 16 – May 22)
('IPL2026-060', 60, 2026, 'Kolkata Knight Riders',        'Gujarat Titans',       '2026-05-16', '2026-05-16 14:00:00+00', 8, 'Kolkata'),
('IPL2026-061', 61, 2026, 'Punjab Kings',                 'Royal Challengers Bengaluru','2026-05-17','2026-05-17 10:00:00+00', 8, 'Dharamshala'),
('IPL2026-062', 62, 2026, 'Delhi Capitals',               'Rajasthan Royals',     '2026-05-17', '2026-05-17 14:00:00+00', 8, 'Delhi'),
('IPL2026-063', 63, 2026, 'Chennai Super Kings',          'Sunrisers Hyderabad',  '2026-05-18', '2026-05-18 14:00:00+00', 8, 'Chennai'),
('IPL2026-064', 64, 2026, 'Rajasthan Royals',             'Lucknow Super Giants', '2026-05-19', '2026-05-19 14:00:00+00', 8, 'Jaipur'),
('IPL2026-065', 65, 2026, 'Kolkata Knight Riders',        'Mumbai Indians',       '2026-05-20', '2026-05-20 14:00:00+00', 8, 'Kolkata'),
('IPL2026-066', 66, 2026, 'Chennai Super Kings',          'Gujarat Titans',       '2026-05-21', '2026-05-21 14:00:00+00', 8, 'Chennai'),
('IPL2026-067', 67, 2026, 'Sunrisers Hyderabad',          'Royal Challengers Bengaluru','2026-05-22','2026-05-22 14:00:00+00', 8, 'Hyderabad'),

-- WEEK 9 — Final round (May 23 – May 24)
('IPL2026-068', 68, 2026, 'Lucknow Super Giants',         'Punjab Kings',         '2026-05-23', '2026-05-23 14:00:00+00', 9, 'Lucknow'),
('IPL2026-069', 69, 2026, 'Mumbai Indians',               'Rajasthan Royals',     '2026-05-24', '2026-05-24 10:00:00+00', 9, 'Mumbai'),
('IPL2026-070', 70, 2026, 'Kolkata Knight Riders',        'Delhi Capitals',       '2026-05-24', '2026-05-24 14:00:00+00', 9, 'Kolkata')

ON CONFLICT (match_id) DO NOTHING;
