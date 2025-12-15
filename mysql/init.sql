-- 创建数据库
CREATE DATABASE IF NOT EXISTS CAD_db
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE CAD_db;


CREATE TABLE occ_models (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  shape_data LONGBLOB,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE occ_sketches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  shape_data LONGBLOB,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE sketches (
    id INT AUTO_INCREMENT PRIMARY KEY,   -- 32位自增主键
    frontend_id VARCHAR(64),                -- 前端生成的唯一ID
    name VARCHAR(255) NOT NULL,             -- 草图名称
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    json_data LONGTEXT NOT NULL             -- 草图 JSON 数据
);

-- 可选：插入一条示例数据
--INSERT INTO messages (content) VALUES ('Hello World!');