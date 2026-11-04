CREATE DATABASE IF NOT EXISTS `lab` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `lab`;

CREATE TABLE IF NOT EXISTS `historiales_clinicos` (
  `ID_Paciente`           INT           NOT NULL,
  `Nombre_Completo`       VARCHAR(255)  NOT NULL,
  `Genero`                VARCHAR(20)   NOT NULL,
  `Fecha_Nacimiento`      VARCHAR(20)   NULL,
  `Tipo_Sangre`           VARCHAR(6)    NOT NULL,
  `Fecha_Ingreso`         DATE          NULL,
  `Diagnostico_Principal` VARCHAR(100)  NOT NULL,
  `Tratamiento_Asignado`  VARCHAR(80)   NOT NULL,
  `Medico_Tratante`       VARCHAR(255)  NOT NULL,
  `Estado_Paciente`       VARCHAR(40)   NOT NULL,
  `Telefono_Emergencia`   VARCHAR(40)   NOT NULL,
  `Costo_Atencion_USD`    DECIMAL(12,2) NOT NULL,
  `Edad`                  INT           NOT NULL,
  PRIMARY KEY (`ID_Paciente`)
); 

CREATE TABLE `Users` (
  `uid` int PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(60) NOT NULL
);

CREATE TABLE `Passwords` (
  `uid` int PRIMARY KEY,
  `pwd` varchar(60) NOT NULL
);

ALTER TABLE `Passwords` ADD FOREIGN KEY (`uid`) REFERENCES `Users` (`uid`);
