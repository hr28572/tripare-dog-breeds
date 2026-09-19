CREATE TABLE `breed_images` (
	`id` text PRIMARY KEY NOT NULL,
	`image_id` text NOT NULL,
	`breed_id` text NOT NULL,
	`variant` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`url` text NOT NULL,
	`author` text,
	`license` text,
	`license_url` text,
	`source` text,
	`source_url` text,
	`cached_locally` integer DEFAULT false NOT NULL,
	`local_uri` text,
	`byte_size` integer,
	`last_accessed_at` integer,
	FOREIGN KEY (`breed_id`) REFERENCES `breeds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `breed_images_breed_id_idx` ON `breed_images` (`breed_id`);--> statement-breakpoint
CREATE INDEX `breed_images_breed_variant_idx` ON `breed_images` (`breed_id`,`variant`,`position`);--> statement-breakpoint
CREATE INDEX `breed_images_cache_idx` ON `breed_images` (`cached_locally`,`last_accessed_at`);--> statement-breakpoint
CREATE TABLE `breeds` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`other_names` text DEFAULT '[]' NOT NULL,
	`description` text,
	`life_min` integer,
	`life_max` integer,
	`male_weight_min` real,
	`male_weight_max` real,
	`female_weight_min` real,
	`female_weight_max` real,
	`male_height_min` real,
	`male_height_max` real,
	`female_height_min` real,
	`female_height_max` real,
	`origin_era` text,
	`origin_region` text,
	`origin_country` text,
	`hypoallergenic` integer DEFAULT false NOT NULL,
	`coat_length` text,
	`coat_type` text,
	`coat_colors` text DEFAULT '[]' NOT NULL,
	`size_band` text,
	`energy` integer,
	`barking` integer,
	`drooling` integer,
	`grooming` integer,
	`shedding` integer,
	`trainability` integer,
	`good_with_dogs` integer,
	`good_with_children` integer,
	`good_with_strangers` integer,
	`apartment_friendly` integer,
	`exercise_minutes` integer,
	`temperament` text DEFAULT '[]' NOT NULL,
	`recognized_by` text DEFAULT '[]' NOT NULL,
	`sources` text DEFAULT '[]' NOT NULL,
	`group_id` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `breeds_name_idx` ON `breeds` (`name`);--> statement-breakpoint
CREATE INDEX `breeds_size_band_idx` ON `breeds` (`size_band`);--> statement-breakpoint
CREATE INDEX `breeds_group_id_idx` ON `breeds` (`group_id`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`last_attempt_at` integer,
	`last_synced_at` integer,
	`last_sync_status` text,
	`last_error` text,
	`breed_count` integer DEFAULT 0 NOT NULL,
	`image_count` integer DEFAULT 0 NOT NULL,
	`parse_failure_count` integer DEFAULT 0 NOT NULL
);
