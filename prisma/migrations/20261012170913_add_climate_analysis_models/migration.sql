-- CreateTable
CREATE TABLE `WeatherDataSource` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `provider` VARCHAR(100) NOT NULL,
    `dataset` VARCHAR(100) NOT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `timezone` VARCHAR(100) NOT NULL DEFAULT 'auto',
    `coverageStart` VARCHAR(10) NOT NULL,
    `coverageEnd` VARCHAR(10) NOT NULL,
    `quality` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `weather_source_cache_key`(`provider`, `dataset`, `latitude`, `longitude`, `coverageStart`, `coverageEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClimateObservation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sourceId` INTEGER NOT NULL,
    `observationDate` VARCHAR(10) NOT NULL,
    `temperatureMax` DOUBLE NULL,
    `rawPayload` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ClimateObservation_observationDate_idx`(`observationDate`),
    UNIQUE INDEX `ClimateObservation_sourceId_observationDate_key`(`sourceId`, `observationDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClimateAnalysis` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `location` VARCHAR(255) NOT NULL,
    `startYear` INTEGER NOT NULL,
    `endYear` INTEGER NOT NULL,
    `hazard` VARCHAR(50) NOT NULL DEFAULT 'Heatwave',
    `status` VARCHAR(30) NOT NULL DEFAULT 'completed',
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ClimateAnalysis_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ClimateObservation` ADD CONSTRAINT `ClimateObservation_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `WeatherDataSource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
