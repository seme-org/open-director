-- OpenDirector schema. Generated from prisma/schema.prisma for MySQL.

-- Users & Auth
CREATE TABLE `users` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `image` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `users_email_key`(`email`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sessions` (
  `id` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `sessions_tokenHash_key`(`tokenHash`),
  INDEX `sessions_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Threads & Messages
CREATE TABLE `threads` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `coverUrl` TEXT NULL,
  `intent` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `isDeleted` BOOLEAN NOT NULL DEFAULT false,
  `deletedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `threads_userId_updatedAt_idx`(`userId`, `updatedAt`),
  INDEX `threads_isDeleted_updatedAt_idx`(`isDeleted`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `messages` (
  `id` VARCHAR(191) NOT NULL,
  `threadId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `role` VARCHAR(191) NOT NULL,
  `content` TEXT NULL,
  `parts` JSON NULL,
  `attachments` JSON NULL,
  `annotations` JSON NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `messages_threadId_createdAt_idx`(`threadId`, `createdAt`),
  INDEX `messages_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Agent State
CREATE TABLE `agent_states` (
  `id` VARCHAR(191) NOT NULL,
  `threadId` VARCHAR(191) NOT NULL,
  `state` JSON NOT NULL,
  `currentStep` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `agent_states_threadId_key`(`threadId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Recipes & Blocks
CREATE TABLE `recipes` (
  `id` VARCHAR(191) NOT NULL,
  `threadId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(191) NOT NULL,
  `content` JSON NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `recipes_threadId_version_idx`(`threadId`, `version`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `blocks` (
  `id` VARCHAR(191) NOT NULL,
  `threadId` VARCHAR(191) NOT NULL,
  `order` INTEGER NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `script` TEXT NULL,
  `visualPrompt` TEXT NULL,
  `audioPrompt` TEXT NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `blocks_threadId_order_idx`(`threadId`, `order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Assets
CREATE TABLE `assets` (
  `id` VARCHAR(191) NOT NULL,
  `threadId` VARCHAR(191) NULL,
  `blockId` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NULL,
  `type` ENUM('IMAGE','VIDEO','AUDIO','TEXT','RENDER','OTHER') NOT NULL DEFAULT 'OTHER',
  `title` VARCHAR(191) NOT NULL,
  `url` TEXT NULL,
  `objectKey` VARCHAR(191) NULL,
  `mimeType` VARCHAR(191) NULL,
  `size` BIGINT NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `assets_objectKey_key`(`objectKey`),
  INDEX `assets_threadId_createdAt_idx`(`threadId`, `createdAt`),
  INDEX `assets_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Subjects (characters)
CREATE TABLE `subjects` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `imageUrl` TEXT NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Voices catalog
CREATE TABLE `voices` (
  `voice_id` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `voice_sample` VARCHAR(526) NULL,
  `user_id` VARCHAR(255) NULL,
  `gender` VARCHAR(32) NOT NULL DEFAULT 'unknown',
  `detail` VARCHAR(255) NULL,
  `model` VARCHAR(128) NOT NULL DEFAULT 'speech-02-hd',
  `parameters` JSON NULL,
  `provider` VARCHAR(128) NOT NULL DEFAULT 'wavespeed',
  `is_public` TINYINT(1) NOT NULL DEFAULT 0,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`voice_id`),
  INDEX `idx_voices_user_id`(`user_id`),
  INDEX `idx_voices_provider`(`provider`),
  INDEX `idx_voices_is_public`(`is_public`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Art styles catalog
CREATE TABLE `art_styles` (
  `art_style_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `category` VARCHAR(128) NOT NULL,
  `image_url` VARCHAR(512) NULL,
  `description` VARCHAR(255) NULL,
  `prompt_prefix` TEXT NOT NULL,
  `keywords` JSON NULL,
  `user_id` VARCHAR(255) NULL,
  `is_public` TINYINT(1) NOT NULL DEFAULT 0,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`art_style_id`),
  INDEX `idx_art_styles_user_id`(`user_id`),
  INDEX `idx_art_styles_is_public`(`is_public`),
  INDEX `idx_art_styles_category`(`category`),
  INDEX `idx_art_styles_name`(`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- BGM tracks catalog
CREATE TABLE `bgms` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `url` VARCHAR(512) NOT NULL,
  `category` VARCHAR(128) NULL,
  `description` VARCHAR(255) NULL,
  `user_id` VARCHAR(255) NULL,
  `is_public` TINYINT(1) NOT NULL DEFAULT 0,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_bgms_user_id`(`user_id`),
  INDEX `idx_bgms_is_public`(`is_public`),
  INDEX `idx_bgms_category`(`category`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Uploads
CREATE TABLE `uploads` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `assetId` VARCHAR(191) NULL,
  `objectKey` VARCHAR(191) NOT NULL,
  `fileName` VARCHAR(191) NOT NULL,
  `mimeType` VARCHAR(191) NOT NULL,
  `size` BIGINT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completedAt` DATETIME(3) NULL,
  UNIQUE INDEX `uploads_objectKey_key`(`objectKey`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Jobs & Render
CREATE TABLE `jobs` (
  `id` VARCHAR(191) NOT NULL,
  `queueId` VARCHAR(191) NULL,
  `threadId` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NULL,
  `batchItemId` VARCHAR(191) NULL,
  `type` VARCHAR(191) NOT NULL,
  `status` ENUM('QUEUED','ACTIVE','COMPLETED','FAILED') NOT NULL DEFAULT 'QUEUED',
  `progress` INTEGER NOT NULL DEFAULT 0,
  `input` JSON NULL,
  `output` JSON NULL,
  `error` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `finishedAt` DATETIME(3) NULL,
  UNIQUE INDEX `jobs_queueId_key`(`queueId`),
  INDEX `jobs_threadId_createdAt_idx`(`threadId`, `createdAt`),
  INDEX `jobs_batchItemId_idx`(`batchItemId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tool_calls` (
  `id` VARCHAR(191) NOT NULL,
  `threadId` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING','RUNNING','COMPLETED','FAILED') NOT NULL DEFAULT 'PENDING',
  `args` JSON NULL,
  `result` JSON NULL,
  `error` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `render_outputs` (
  `id` VARCHAR(191) NOT NULL,
  `threadId` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NULL,
  `jobId` VARCHAR(191) NULL,
  `assetId` VARCHAR(191) NULL,
  `url` TEXT NOT NULL,
  `objectKey` VARCHAR(191) NOT NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Batch mode
CREATE TABLE `batches` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `title` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'QUEUED',
  `itemCount` INTEGER NOT NULL DEFAULT 0,
  `outputCount` INTEGER NOT NULL DEFAULT 0,
  `settings` JSON NOT NULL,
  `deleted` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `finishedAt` DATETIME(3) NULL,
  INDEX `batches_userId_updatedAt_idx`(`userId`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `batch_items` (
  `id` VARCHAR(191) NOT NULL,
  `batchId` VARCHAR(191) NOT NULL,
  `order` INTEGER NOT NULL,
  `subject` TEXT NULL,
  `script` TEXT NULL,
  `terms` JSON NULL,
  `resolvedScript` TEXT NULL,
  `resolvedTerms` JSON NULL,
  `materials` JSON NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'QUEUED',
  `statusDetail` TEXT NULL,
  `progress` INTEGER NOT NULL DEFAULT 0,
  `error` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `finishedAt` DATETIME(3) NULL,
  INDEX `batch_items_batchId_order_idx`(`batchId`, `order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `batch_outputs` (
  `id` VARCHAR(191) NOT NULL,
  `batchItemId` VARCHAR(191) NOT NULL,
  `jobId` VARCHAR(191) NULL,
  `url` TEXT NOT NULL,
  `objectKey` VARCHAR(191) NULL,
  `title` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `batch_outputs_batchItemId_createdAt_idx`(`batchItemId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `threads` ADD CONSTRAINT `threads_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `messages` ADD CONSTRAINT `messages_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `threads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `messages` ADD CONSTRAINT `messages_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `agent_states` ADD CONSTRAINT `agent_states_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `threads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `recipes` ADD CONSTRAINT `recipes_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `threads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `blocks` ADD CONSTRAINT `blocks_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `threads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `assets` ADD CONSTRAINT `assets_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `threads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `assets` ADD CONSTRAINT `assets_blockId_fkey` FOREIGN KEY (`blockId`) REFERENCES `blocks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `assets` ADD CONSTRAINT `assets_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `subjects` ADD CONSTRAINT `subjects_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `uploads` ADD CONSTRAINT `uploads_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `uploads` ADD CONSTRAINT `uploads_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `threads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_batchItemId_fkey` FOREIGN KEY (`batchItemId`) REFERENCES `batch_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `tool_calls` ADD CONSTRAINT `tool_calls_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `threads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `tool_calls` ADD CONSTRAINT `tool_calls_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `render_outputs` ADD CONSTRAINT `render_outputs_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `threads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `render_outputs` ADD CONSTRAINT `render_outputs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `render_outputs` ADD CONSTRAINT `render_outputs_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `render_outputs` ADD CONSTRAINT `render_outputs_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `batches` ADD CONSTRAINT `batches_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `batch_items` ADD CONSTRAINT `batch_items_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `batch_outputs` ADD CONSTRAINT `batch_outputs_batchItemId_fkey` FOREIGN KEY (`batchItemId`) REFERENCES `batch_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed data: default art styles
INSERT INTO `art_styles`
(`art_style_id`, `name`, `category`, `image_url`, `description`, `prompt_prefix`, `keywords`, `is_public`)
VALUES
('as_1001', 'Epic Narrative Cinema', 'cinematic', 'https://files.seme.cc/styles/style_01.jpg', 'Grand cinematic visuals with dramatic lighting and emotional storytelling', 'epic cinematic scene, dramatic lighting, rich atmosphere, film-grade composition, emotional visual storytelling', '["cinematic","epic","film","dramatic"]', 1),

('as_1002', 'Luxury Product Visual', 'commercial', 'https://files.seme.cc/styles/style_02.jpg', 'Premium product photography with refined studio lighting', 'luxury product photography, premium studio lighting, elegant composition, high-end commercial look, clean background', '["luxury","product","studio","premium"]', 1),

('as_1003', 'Futuristic Neon Noir', 'futuristic', 'https://files.seme.cc/styles/style_03.jpg', 'Dark futuristic atmosphere with neon lighting and cyber mood', 'futuristic neon noir, glowing city lights, cyber atmosphere, dark cinematic shadows, high contrast', '["neon","future","cyber","noir"]', 1),

('as_1004', 'Analog Memory Frame', 'retro', 'https://files.seme.cc/styles/style_04.jpg', 'Warm nostalgic film texture with analog color tones', 'analog film aesthetic, warm vintage tones, subtle grain, nostalgic memory-like atmosphere, soft imperfections', '["analog","vintage","film","nostalgia"]', 1),

('as_1005', 'Monochrome Tension', 'cinematic', 'https://files.seme.cc/styles/style_05.jpg', 'Black and white visuals with strong contrast and dramatic shadows', 'monochrome cinematic style, black and white, sharp contrast, dramatic shadows, tense atmosphere', '["black-white","contrast","shadow","moody"]', 1),

('as_1006', 'Retro Signal Distortion', 'retro', 'https://files.seme.cc/styles/style_06.jpg', 'Old video signal look with tape noise and lo-fi texture', 'retro video signal, tape distortion, scan lines, lo-fi camcorder texture, imperfect analog footage', '["vhs","lofi","retro","distortion"]', 1),

('as_1007', 'Hyperreal Manga Fusion', 'anime', 'https://files.seme.cc/styles/style_07.jpg', 'Realistic scenes blended with expressive manga-inspired visual energy', 'hyperreal manga fusion, realistic world with stylized anime energy, expressive faces, clean dramatic lighting', '["manga","anime","hyperreal","stylized"]', 1),

('as_1008', 'Warm Character Animation', '3d', 'https://files.seme.cc/styles/style_08.jpg', 'Friendly 3D animated character style with soft lighting', 'warm 3D character animation, friendly proportions, soft lighting, colorful world, expressive emotions', '["3d","animation","character","warm"]', 1),

('as_1009', 'Enchanted Fantasy Render', '3d', 'https://files.seme.cc/styles/style_09.jpg', 'Magical 3D fantasy world with glowing details and soft atmosphere', 'enchanted fantasy 3D render, magical atmosphere, glowing details, rich textures, whimsical lighting', '["fantasy","3d","magic","render"]', 1),

('as_1010', 'Expressive Adventure CG', '3d', 'https://files.seme.cc/styles/style_10.jpg', 'Bold animated CG style with energetic characters and adventure tone', 'expressive adventure CG, bold character design, vibrant colors, dynamic camera angle, animated storytelling', '["cg","adventure","expressive","animation"]', 1),

('as_1011', 'Dreamscape Watercolor Anime', 'anime', 'https://files.seme.cc/styles/style_11.jpg', 'Soft hand-painted anime mood with dreamy natural colors', 'dreamscape watercolor anime, soft painted backgrounds, gentle colors, poetic atmosphere, hand-crafted feel', '["anime","watercolor","dreamy","soft"]', 1),

('as_1012', 'Digital Arcade Retro', 'retro', 'https://files.seme.cc/styles/style_12.jpg', 'Pixel-inspired digital artwork with classic arcade energy', 'digital arcade retro, pixel-inspired visuals, 8-bit game atmosphere, limited color palette, nostalgic gaming feel', '["pixel","arcade","retro","game"]', 1),

('as_1013', 'Vertical Story Illustration', 'illustration', 'https://files.seme.cc/styles/style_13.jpg', 'Clean vertical comic storytelling with expressive characters', 'vertical story illustration, clean line art, expressive characters, modern comic panel composition, vibrant colors', '["webcomic","story","illustration","vertical"]', 1),

('as_1014', 'Storybook Wonder', 'illustration', 'https://files.seme.cc/styles/style_14.jpg', 'Warm and charming illustrated look for gentle storytelling', 'storybook illustration, warm colors, charming characters, soft texture, friendly magical atmosphere', '["storybook","children","warm","cute"]', 1),

('as_1015', 'Premium VFX Realism', '3d', 'https://files.seme.cc/styles/style_15.jpg', 'High-end realistic CGI with cinematic VFX detail', 'premium VFX realism, photoreal 3D rendering, cinematic lighting, detailed textures, high-end visual effects', '["vfx","cgi","realistic","premium"]', 1),

('as_1016', 'Layered Craft Dimension', 'illustration', 'https://files.seme.cc/styles/style_16.jpg', 'Handmade layered paper craft with dimensional depth', 'layered craft dimension, cut paper look, handmade texture, soft shadows, tactile composition', '["paper","craft","layered","handmade"]', 1),

('as_1017', 'Handmade Stop-Motion', '3d', 'https://files.seme.cc/styles/style_17.jpg', 'Tactile miniature animation look with handmade materials', 'handmade stop-motion style, tactile clay texture, miniature set design, imperfect handcrafted animation feel', '["stop-motion","handmade","clay","miniature"]', 1),

('as_1018', 'Modern Vector Minimal', 'illustration', 'https://files.seme.cc/styles/style_18.jpg', 'Clean geometric vector style with modern simplicity', 'modern vector minimal, clean shapes, flat colors, geometric layout, simple elegant illustration', '["vector","minimal","flat","modern"]', 1),

('as_1019', 'Fluid Pigment Art', 'illustration', 'https://files.seme.cc/styles/style_19.jpg', 'Soft flowing watercolor and pigment textures', 'fluid pigment art, watercolor texture, soft gradients, organic brush flow, artistic hand-painted mood', '["watercolor","pigment","artistic","soft"]', 1),

('as_1020', 'Graphic Hero Panel', 'illustration', 'https://files.seme.cc/styles/style_20.jpg', 'Bold comic-style action with strong outlines and dynamic framing', 'graphic hero panel, bold ink outlines, dynamic action pose, halftone texture, dramatic comic composition', '["comic","hero","graphic","action"]', 1),

('as_1021', 'Editorial Fashion Film', 'commercial', 'https://files.seme.cc/styles/style_21.jpg', 'High-fashion magazine look with cinematic elegance', 'editorial fashion film, luxury magazine lighting, elegant pose, refined color grading, premium visual direction', '["fashion","editorial","luxury","cinematic"]', 1),

('as_1022', 'Documentary Realism', 'realistic', 'https://files.seme.cc/styles/style_22.jpg', 'Natural authentic visual style with real-world lighting', 'documentary realism, natural light, authentic human moment, subtle camera movement, grounded realistic atmosphere', '["documentary","realistic","natural","authentic"]', 1),

('as_1023', 'Urban Techwear Mood', 'futuristic', 'https://files.seme.cc/styles/style_23.jpg', 'Modern streetwear visuals with dark urban atmosphere', 'urban techwear mood, dark city street, functional fashion, futuristic accessories, cinematic urban lighting', '["techwear","urban","fashion","dark"]', 1),

('as_1024', 'High CTR Ad Creative', 'commercial', 'https://files.seme.cc/styles/style_24.jpg', 'Bright commercial visual style optimized for attention and clarity', 'high CTR ad creative, bold subject, clean readable composition, vibrant lighting, strong focal point', '["ad","marketing","bright","attention"]', 1),

('as_1025', 'Startup Promo Visual', 'commercial', 'https://files.seme.cc/styles/style_25.jpg', 'Clean modern SaaS promo style with polished business energy', 'startup promo visual, modern tech branding, clean composition, confident lighting, polished SaaS commercial style', '["startup","saas","promo","clean"]', 1),

('as_1026', 'Founder Personal Brand', 'commercial', 'https://files.seme.cc/styles/style_26.jpg', 'Professional personal-brand portrait style for founders and creators', 'founder personal brand portrait, confident expression, modern workspace, premium natural lighting, professional but approachable', '["founder","portrait","brand","professional"]', 1),

('as_1027', 'Luxury Ecommerce Shot', 'commercial', 'https://files.seme.cc/styles/style_27.jpg', 'Premium ecommerce product scene with clean luxury presentation', 'luxury ecommerce shot, elegant product placement, soft studio shadow, premium lifestyle background, commercial polish', '["ecommerce","luxury","product","clean"]', 1),

('as_1028', 'Music Video Mood', 'cinematic', 'https://files.seme.cc/styles/style_28.jpg', 'Stylized music-video visuals with expressive lighting and movement', 'music video mood, expressive lighting, rhythmic composition, stylish camera angle, cinematic performance atmosphere', '["music","video","stylish","cinematic"]', 1),

('as_1029', 'Surreal Fine Art', 'experimental', 'https://files.seme.cc/styles/style_29.jpg', 'Dreamlike symbolic scenes with fine-art composition', 'surreal fine art, dreamlike symbolism, impossible scene, painterly composition, museum-quality atmosphere', '["surreal","fine-art","dream","symbolic"]', 1),

('as_1030', 'Architectural Visualization', 'realistic', 'https://files.seme.cc/styles/style_30.jpg', 'Clean architectural rendering with premium spatial design', 'architectural visualization, realistic interior or exterior render, natural lighting, clean materials, premium spatial composition', '["architecture","interior","render","space"]', 1),

('as_1031', 'Scandinavian Interior Mood', 'realistic', 'https://files.seme.cc/styles/style_31.jpg', 'Soft minimal interior visuals with calm Nordic atmosphere', 'scandinavian interior mood, natural wood, soft daylight, minimal decor, calm neutral palette, cozy elegant space', '["interior","scandinavian","minimal","cozy"]', 1),

('as_1032', 'Hypercar Showcase', 'commercial', 'https://files.seme.cc/styles/style_32.jpg', 'Premium automotive visuals with dramatic reflections and motion', 'hypercar showcase, glossy reflections, dramatic studio or street lighting, premium automotive photography, powerful composition', '["car","automotive","luxury","motion"]', 1),

('as_1033', 'Cyber Editorial', 'futuristic', 'https://files.seme.cc/styles/style_33.jpg', 'Futuristic magazine-style visuals with cyber fashion energy', 'cyber editorial, futuristic fashion, neon accents, magazine composition, high contrast tech aesthetic', '["cyber","editorial","fashion","future"]', 1),

('as_1034', 'AI Concept Design', 'experimental', 'https://files.seme.cc/styles/style_34.jpg', 'Concept-art style for futuristic products, worlds, and characters', 'AI concept design, futuristic concept art, detailed design language, imaginative object or environment, polished visual exploration', '["concept","design","future","creative"]', 1),


-- Seed data: default voices (Edge TTS)
INSERT INTO `voices` (`voice_id`, `name`, `gender`, `detail`, `provider`, `is_public`) VALUES
('zh-CN-XiaoxiaoNeural', '晓晓', 'female', '温暖亲切的女声，适合日常旁白', 'edge-tts', 1),
('zh-CN-XiaoyiNeural', '晓伊', 'female', '温柔知性的女声，适合抒情内容', 'edge-tts', 1),
('zh-CN-YunjianNeural', '云健', 'male', '沉稳有力的男声，适合正式场合', 'edge-tts', 1),
('zh-CN-YunxiNeural', '云希', 'male', '年轻活力的男声，适合讲故事', 'edge-tts', 1),
('zh-CN-YunxiaNeural', '云夏', 'male', '青春活力的男声，适合轻松内容', 'edge-tts', 1),
('zh-CN-YunyangNeural', '云扬', 'male', '专业播音的男声，适合新闻播报', 'edge-tts', 1),
('en-US-JennyNeural', 'Jenny', 'female', 'Friendly American English female voice', 'edge-tts', 1),
('en-US-GuyNeural', 'Guy', 'male', 'Professional American English male voice', 'edge-tts', 1),
('en-US-AriaNeural', 'Aria', 'female', 'Expressive American English female voice', 'edge-tts', 1),
('en-GB-SoniaNeural', 'Sonia', 'female', 'British English female voice', 'edge-tts', 1),
('ja-JP-NanamiNeural', 'Nanami', 'female', 'Japanese female voice', 'edge-tts', 1),
('ja-JP-KeitaNeural', 'Keita', 'male', 'Japanese male voice', 'edge-tts', 1),
('ko-KR-SunHiNeural', 'SunHi', 'female', 'Korean female voice', 'edge-tts', 1),
('ko-KR-InJoonNeural', 'InJoon', 'male', 'Korean male voice', 'edge-tts', 1);

-- Seed data: default BGM tracks
INSERT INTO `bgms` (`id`, `name`, `url`, `category`, `description`, `is_public`) VALUES
('bgm_000', 'output000', 'https://files.seme.cc/music/output000.mp3', 'default', 'Default background music track', 1),
('bgm_001', 'output001', 'https://files.seme.cc/music/output001.mp3', 'default', 'Default background music track', 1),
('bgm_002', 'output002', 'https://files.seme.cc/music/output002.mp3', 'default', 'Default background music track', 1),
('bgm_003', 'output003', 'https://files.seme.cc/music/output003.mp3', 'default', 'Default background music track', 1),
('bgm_004', 'output004', 'https://files.seme.cc/music/output004.mp3', 'default', 'Default background music track', 1),
('bgm_005', 'output005', 'https://files.seme.cc/music/output005.mp3', 'default', 'Default background music track', 1),
('bgm_006', 'output006', 'https://files.seme.cc/music/output006.mp3', 'default', 'Default background music track', 1),
('bgm_007', 'output007', 'https://files.seme.cc/music/output007.mp3', 'default', 'Default background music track', 1),
('bgm_008', 'output008', 'https://files.seme.cc/music/output008.mp3', 'default', 'Default background music track', 1),
('bgm_009', 'output009', 'https://files.seme.cc/music/output009.mp3', 'default', 'Default background music track', 1),
('bgm_010', 'output010', 'https://files.seme.cc/music/output010.mp3', 'default', 'Default background music track', 1),
('bgm_011', 'output011', 'https://files.seme.cc/music/output011.mp3', 'default', 'Default background music track', 1),
('bgm_012', 'output012', 'https://files.seme.cc/music/output012.mp3', 'default', 'Default background music track', 1),
('bgm_013', 'output013', 'https://files.seme.cc/music/output013.mp3', 'default', 'Default background music track', 1),
('bgm_014', 'output014', 'https://files.seme.cc/music/output014.mp3', 'default', 'Default background music track', 1),
('bgm_015', 'output015', 'https://files.seme.cc/music/output015.mp3', 'default', 'Default background music track', 1),
('bgm_016', 'output016', 'https://files.seme.cc/music/output016.mp3', 'default', 'Default background music track', 1),
('bgm_017', 'output017', 'https://files.seme.cc/music/output017.mp3', 'default', 'Default background music track', 1),
('bgm_018', 'output018', 'https://files.seme.cc/music/output018.mp3', 'default', 'Default background music track', 1),
('bgm_019', 'output019', 'https://files.seme.cc/music/output019.mp3', 'default', 'Default background music track', 1),
('bgm_020', 'output020', 'https://files.seme.cc/music/output020.mp3', 'default', 'Default background music track', 1),
('bgm_021', 'output021', 'https://files.seme.cc/music/output021.mp3', 'default', 'Default background music track', 1),
('bgm_022', 'output022', 'https://files.seme.cc/music/output022.mp3', 'default', 'Default background music track', 1),
('bgm_023', 'output023', 'https://files.seme.cc/music/output023.mp3', 'default', 'Default background music track', 1),
('bgm_024', 'output024', 'https://files.seme.cc/music/output024.mp3', 'default', 'Default background music track', 1),
('bgm_025', 'output025', 'https://files.seme.cc/music/output025.mp3', 'default', 'Default background music track', 1),
('bgm_027', 'output027', 'https://files.seme.cc/music/output027.mp3', 'default', 'Default background music track', 1),
('bgm_028', 'output028', 'https://files.seme.cc/music/output028.mp3', 'default', 'Default background music track', 1),
('bgm_029', 'output029', 'https://files.seme.cc/music/output029.mp3', 'default', 'Default background music track', 1);
