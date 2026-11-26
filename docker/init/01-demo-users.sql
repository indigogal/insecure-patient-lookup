-- Demo user documented in the README (uid=1 / admin / admin).
INSERT INTO `Users` (`uid`, `name`) VALUES (1, 'admin')
  ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `Passwords` (`uid`, `pwd`) VALUES (1, 'admin')
  ON DUPLICATE KEY UPDATE `pwd` = VALUES(`pwd`);
