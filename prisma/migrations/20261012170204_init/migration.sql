-- CreateTable
CREATE TABLE `Region` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `regionType` VARCHAR(30) NOT NULL DEFAULT 'CITY',
    `country` VARCHAR(100) NOT NULL DEFAULT 'India',
    `state` VARCHAR(100) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Region_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WeatherObservation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `regionId` INTEGER NOT NULL,
    `observedAt` DATE NOT NULL,
    `maxTemperature` DOUBLE NULL,
    `minTemperature` DOUBLE NULL,
    `meanTemperature` DOUBLE NULL,
    `precipitation` DOUBLE NULL,
    `source` VARCHAR(50) NOT NULL DEFAULT 'Open-Meteo',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WeatherObservation_observedAt_idx`(`observedAt`),
    UNIQUE INDEX `WeatherObservation_regionId_observedAt_key`(`regionId`, `observedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WeatherObservation` ADD CONSTRAINT `WeatherObservation_regionId_fkey` FOREIGN KEY (`regionId`) REFERENCES `Region`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
