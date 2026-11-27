-- Demo user documented in the README (uid=1 / admin / admin).
INSERT INTO `Users` (`uid`, `name`) VALUES (1, 'admin')
  ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- bcrypt hash of "admin" (cost 10).
INSERT INTO `Passwords` (`uid`, `pwd`) VALUES (1, '$2b$10$qjIs1yWQj0Nce/Xhus.OiOlZ/kOkVnOrRprnap6kpjnpmCt1jayEW')
  ON DUPLICATE KEY UPDATE `pwd` = VALUES(`pwd`);
