-- CreateTable
CREATE TABLE `PdfArtifact` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `storagePath` VARCHAR(500) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `size` INTEGER NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PdfArtifact_tenantId_idx`(`tenantId`),
    INDEX `PdfArtifact_reportId_idx`(`reportId`),
    UNIQUE INDEX `PdfArtifact_reportId_version_key`(`reportId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PdfArtifact` ADD CONSTRAINT `PdfArtifact_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PdfArtifact` ADD CONSTRAINT `PdfArtifact_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `Report`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PdfArtifact` ADD CONSTRAINT `PdfArtifact_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
