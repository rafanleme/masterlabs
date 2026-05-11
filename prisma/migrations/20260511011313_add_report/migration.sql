-- CreateTable
CREATE TABLE `Report` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `sampleId` VARCHAR(191) NOT NULL,
    `reportTemplateId` VARCHAR(191) NOT NULL,
    `numeroLaudo` VARCHAR(191) NOT NULL,
    `status` ENUM('RASCUNHO', 'EMITIDO', 'CANCELADO') NOT NULL DEFAULT 'RASCUNHO',
    `dataEmissao` DATETIME(3) NULL,
    `responsavel` VARCHAR(191) NULL,
    `observacoes` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Report_tenantId_idx`(`tenantId`),
    INDEX `Report_tenantId_sampleId_idx`(`tenantId`, `sampleId`),
    INDEX `Report_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `Report_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `Report_tenantId_numeroLaudo_key`(`tenantId`, `numeroLaudo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReportItem` (
    `id` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `assayId` VARCHAR(191) NOT NULL,
    `ordem` INTEGER NOT NULL,
    `valor` VARCHAR(191) NULL,
    `valorNumerico` DOUBLE NULL,
    `conformidade` ENUM('CONFORME', 'NAO_CONFORME', 'INCONCLUSIVO') NOT NULL DEFAULT 'INCONCLUSIVO',
    `observacoes` VARCHAR(191) NULL,

    INDEX `ReportItem_reportId_idx`(`reportId`),
    UNIQUE INDEX `ReportItem_reportId_assayId_key`(`reportId`, `assayId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_sampleId_fkey` FOREIGN KEY (`sampleId`) REFERENCES `Sample`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_reportTemplateId_fkey` FOREIGN KEY (`reportTemplateId`) REFERENCES `ReportTemplate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportItem` ADD CONSTRAINT `ReportItem_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportItem` ADD CONSTRAINT `ReportItem_assayId_fkey` FOREIGN KEY (`assayId`) REFERENCES `Assay`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
