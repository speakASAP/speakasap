-- CreateTable
CREATE TABLE "products_category" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(64) NOT NULL,
    "product_for_offers" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "products_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products_partpaymentcollection" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(64) NOT NULL,
    "comment" VARCHAR(64),

    CONSTRAINT "products_partpaymentcollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products_partpaymentoption" (
    "id" SERIAL NOT NULL,
    "part_id" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "day" INTEGER NOT NULL DEFAULT 0,
    "open_steps" VARCHAR(255),

    CONSTRAINT "products_partpaymentoption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products_product" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "en_title" VARCHAR(255) NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL,
    "tags" VARCHAR(255),
    "language_id" INTEGER,
    "category_id" INTEGER NOT NULL,
    "label" VARCHAR(255),
    "android_id" VARCHAR(255),
    "material_language" VARCHAR(2) NOT NULL DEFAULT 'ru',
    "trashed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "products_product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products_product_part_payments" (
    "product_id" INTEGER NOT NULL,
    "partpaymentcollection_id" INTEGER NOT NULL,

    CONSTRAINT "products_product_part_payments_pkey" PRIMARY KEY ("product_id","partpaymentcollection_id")
);

-- CreateTable
CREATE TABLE "offers_extralessonsoffer" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "teacher_id" INTEGER,
    "lessons" INTEGER NOT NULL DEFAULT 0,
    "teacher_native_id" INTEGER,
    "lessons_native" INTEGER NOT NULL DEFAULT 0,
    "comment" TEXT,

    CONSTRAINT "offers_extralessonsoffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers_offer" (
    "uuid" UUID NOT NULL,
    "student_id" INTEGER NOT NULL,
    "teacher_id" INTEGER,
    "offerer_id" INTEGER,
    "course_product_id" INTEGER,
    "extra_lessons_id" INTEGER,
    "order_id" INTEGER,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opened" TIMESTAMP(3),

    CONSTRAINT "offers_offer_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "offers_offer_extra_lessons_id_key" ON "offers_offer"("extra_lessons_id");

-- AddForeignKey
ALTER TABLE "products_partpaymentoption" ADD CONSTRAINT "products_partpaymentoption_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "products_partpaymentcollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products_product" ADD CONSTRAINT "products_product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "products_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products_product_part_payments" ADD CONSTRAINT "products_product_part_payments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products_product_part_payments" ADD CONSTRAINT "products_product_part_payments_partpaymentcollection_id_fkey" FOREIGN KEY ("partpaymentcollection_id") REFERENCES "products_partpaymentcollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers_extralessonsoffer" ADD CONSTRAINT "offers_extralessonsoffer_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products_product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers_offer" ADD CONSTRAINT "offers_offer_course_product_id_fkey" FOREIGN KEY ("course_product_id") REFERENCES "products_product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers_offer" ADD CONSTRAINT "offers_offer_extra_lessons_id_fkey" FOREIGN KEY ("extra_lessons_id") REFERENCES "offers_extralessonsoffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
