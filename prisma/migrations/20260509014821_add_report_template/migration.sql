-- CreateTable
CREATE TABLE `ReportTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReportTemplate_tenantId_idx`(`tenantId`),
    INDEX `ReportTemplate_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `ReportTemplate_tenantId_nome_key`(`tenantId`, `nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReportTemplateAssay` (
    `id` VARCHAR(191) NOT NULL,
    `reportTemplateId` VARCHAR(191) NOT NULL,
    `assayId` VARCHAR(191) NOT NULL,
    `ordem` INTEGER NOT NULL,

    INDEX `ReportTemplateAssay_reportTemplateId_idx`(`reportTemplateId`),
    UNIQUE INDEX `ReportTemplateAssay_reportTemplateId_assayId_key`(`reportTemplateId`, `assayId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ReportTemplate` ADD CONSTRAINT `ReportTemplate_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportTemplateAssay` ADD CONSTRAINT `ReportTemplateAssay_reportTemplateId_fkey` FOREIGN KEY (`reportTemplateId`) REFERENCES `ReportTemplate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportTemplateAssay` ADD CONSTRAINT `ReportTemplateAssay_assayId_fkey` FOREIGN KEY (`assayId`) REFERENCES `Assay`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
