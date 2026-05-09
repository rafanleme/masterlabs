-- CreateTable
CREATE TABLE `Assay` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `unidade` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `metodoAnalitico` VARCHAR(191) NULL,
    `tipoComparacao` ENUM('MENOR_QUE', 'MAIOR_QUE', 'MENOR_IGUAL', 'MAIOR_IGUAL', 'ENTRE', 'TEXTO') NULL,
    `limiteMinimo` DOUBLE NULL,
    `limiteMaximo` DOUBLE NULL,
    `valorReferencia` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Assay_tenantId_idx`(`tenantId`),
    INDEX `Assay_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    UNIQUE INDEX `Assay_tenantId_nome_key`(`tenantId`, `nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Assay` ADD CONSTRAINT `Assay_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
