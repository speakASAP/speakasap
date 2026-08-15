-- Theory link for a grammar topic on speakasap.com.
--
-- Nullable: speakasap.com only publishes grammar sections for de/en/es/fr/it/pt, and the
-- taxonomy covers 18 languages. A topic with no page keeps NULL and the UI renders no
-- link, rather than sending a student who just made a mistake to a 404.
ALTER TABLE "grammar_topic" ADD COLUMN "url" VARCHAR(512);
