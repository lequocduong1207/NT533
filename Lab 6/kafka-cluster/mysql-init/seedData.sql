USE sourcedb;

DELIMITER $$
-- Tạo 1000 users
CREATE PROCEDURE seed_users()
BEGIN
    DECLARE i INT DEFAULT 1;

    WHILE i <= 1000 DO
        INSERT INTO users(username, email)
        VALUES (
            CONCAT('user_', i),
            CONCAT('user_', i, '@gmail.com')
        );

        SET i = i + 1;
    END WHILE;
END$$
-- Tạo 5000 posts
CREATE PROCEDURE seed_posts()
BEGIN
    DECLARE i INT DEFAULT 1;

    WHILE i <= 5000 DO
        INSERT INTO posts(user_id,title,content)
        VALUES (
            FLOOR(1 + RAND() * 1000),
            CONCAT('Post title ', i),
            CONCAT('Post content number ', i)
        );

        SET i = i + 1;
    END WHILE;
END$$
-- Tạo 10000 comments
CREATE PROCEDURE seed_comments()
BEGIN
    DECLARE i INT DEFAULT 1;

    WHILE i <= 10000 DO
        INSERT INTO comments(post_id, user_id, content)
        VALUES (
            FLOOR(1 + RAND() * 5000),
            FLOOR(1 + RAND() * 1000),
            CONCAT('Comment number ', i)
        );

        SET i = i + 1;
    END WHILE;
END$$
-- Tạo 100 tags
CREATE PROCEDURE seed_tags()
BEGIN
    DECLARE i INT DEFAULT 1;

    WHILE i <= 100 DO
        INSERT INTO tags(name)
        VALUES (
            CONCAT('tag_', i)
        );

        SET i = i + 1;
    END WHILE;
END$$

DELIMITER ;

CALL seed_users();
CALL seed_posts();
CALL seed_comments();
CALL seed_tags();

DROP PROCEDURE seed_users;
DROP PROCEDURE seed_posts;
DROP PROCEDURE seed_comments;
DROP PROCEDURE seed_tags;