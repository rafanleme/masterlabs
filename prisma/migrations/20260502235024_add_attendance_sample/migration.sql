-- CreateTable
CREATE TABLE `Attendance` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `numeroAtendimento` VARCHAR(191) NOT NULL,
    `status` ENUM('ABERTO', 'EM_ANDAMENTO', 'ENCERRADO', 'CANCELADO') NOT NULL DEFAULT 'ABERTO',
    `tipoColeta` ENUM('IN_LOCO', 'ENTREGA_NO_LABORATORIO') NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `dataSolicitacao` DATETIME(3) NULL,
    `prazoEntrega` DATETIME(3) NULL,
    `responsavel` VARCHAR(191) NULL,
    `observacoes` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Attendance_tenantId_idx`(`tenantId`),
    INDEX `Attendance_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `Attendance_tenantId_clientId_idx`(`tenantId`, `clientId`),
    INDEX `Attendance_tenantId_status_idx`(`tenantId`, `status`),
    UNIQUE INDEX `Attendance_tenantId_numeroAtendimento_key`(`tenantId`, `numeroAtendimento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sample` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `attendanceId` VARCHAR(191) NOT NULL,
    `numeroAmostra` VARCHAR(191) NOT NULL,
    `status` ENUM('RECEBIDA', 'EM_ANALISE', 'CANCELADA', 'REJEITADA', 'CONCLUIDA') NOT NULL DEFAULT 'RECEBIDA',
    `descricao` VARCHAR(191) NOT NULL,
    `dataColeta` DATETIME(3) NULL,
    `dataRecebimento` DATETIME(3) NULL,
    `amostrador` VARCHAR(191) NULL,
    `etiqueta` VARCHAR(191) NULL,
    `motivo` VARCHAR(191) NULL,
    `temperaturaAmostra` DOUBLE NULL,
    `temperaturaAmbiente` DOUBLE NULL,
    `umidadeRelativa` DOUBLE NULL,
    `pontoColeta` VARCHAR(191) NULL,
    `observacoes` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Sample_tenantId_idx`(`tenantId`),
    INDEX `Sample_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `Sample_tenantId_attendanceId_idx`(`tenantId`, `attendanceId`),
    INDEX `Sample_tenantId_status_idx`(`tenantId`, `status`),
    UNIQUE INDEX `Sample_tenantId_numeroAmostra_key`(`tenantId`, `numeroAmostra`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sample` ADD CONSTRAINT `Sample_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sample` ADD CONSTRAINT `Sample_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sample` ADD CONSTRAINT `Sample_attendanceId_fkey` FOREIGN KEY (`attendanceId`) REFERENCES `Attendance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
