-- CreateTable
CREATE TABLE `Tenant` (
    `id` VARCHAR(191) NOT NULL,
    `razaoSocial` VARCHAR(191) NOT NULL,
    `nomeFantasia` VARCHAR(191) NOT NULL,
    `cnpj` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `telefone` VARCHAR(191) NULL,
    `endereco` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Tenant_cnpj_key`(`cnpj`),
    UNIQUE INDEX `Tenant_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'ANALYST', 'VIEWER') NOT NULL DEFAULT 'ANALYST',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `User_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `User_tenantId_email_key`(`tenantId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
