CREATE TABLE `billing_cycles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`interval_months` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_cycles_name_unique` ON `billing_cycles` (`name`);--> statement-breakpoint
CREATE TABLE `billing_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`billing_amount` integer DEFAULT 0 NOT NULL,
	`is_billed` integer DEFAULT 0 NOT NULL,
	`billed_date` text,
	`is_paid` integer DEFAULT 0 NOT NULL,
	`paid_date` text,
	`expected_payment_year` integer NOT NULL,
	`expected_payment_month` integer NOT NULL,
	`note` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_records_customer_id_year_month_unique` ON `billing_records` (`customer_id`,`year`,`month`);--> statement-breakpoint
CREATE TABLE `category_cycles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`name` text NOT NULL,
	`interval_months` integer NOT NULL,
	`multiplier` real,
	`fixed_points` real,
	`requires_insulation_monitor` integer DEFAULT 0 NOT NULL,
	`condition_note` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `equipment_categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `coefficient_rows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`table_id` integer NOT NULL,
	`min_capacity` real NOT NULL,
	`max_capacity` real,
	`coefficient` real NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`table_id`) REFERENCES `coefficient_tables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `coefficient_tables` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`unit` text NOT NULL,
	`note` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customer_facilities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	`category_cycle_id` integer NOT NULL,
	`capacity` real,
	`coefficient_override` real,
	`note` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `equipment_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_cycle_id`) REFERENCES `category_cycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `customer_inspection_months` (
	`customer_id` integer NOT NULL,
	`month` integer NOT NULL,
	PRIMARY KEY(`customer_id`, `month`),
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`inspection_cycle_id` integer NOT NULL,
	`monthly_fee` integer DEFAULT 0 NOT NULL,
	`annual_fee_handling` text DEFAULT 'included' NOT NULL,
	`annual_inspection_fee` integer,
	`unit_price_override` integer,
	`address` text DEFAULT '' NOT NULL,
	`lat` real,
	`lng` real,
	`distance_km` real,
	`duration_min` integer,
	`distance_method` text,
	`distance_updated_at` text,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`contact_person` text DEFAULT '' NOT NULL,
	`contract_start_date` text NOT NULL,
	`contract_end_date` text,
	`annual_inspection_month` integer,
	`annual_inspection_day` integer,
	`billing_cycle_id` integer,
	`payment_lag_months` integer DEFAULT 1 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`inspection_cycle_id`) REFERENCES `inspection_cycles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`billing_cycle_id`) REFERENCES `billing_cycles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_code_unique` ON `customers` (`code`);--> statement-breakpoint
CREATE TABLE `equipment_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category_group` text DEFAULT 'demand' NOT NULL,
	`capacity_unit` text DEFAULT 'kVA' NOT NULL,
	`calculation_method` text DEFAULT 'table' NOT NULL,
	`coefficient_table_id` integer,
	`min_capacity` real,
	`max_capacity` real,
	`note` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`coefficient_table_id`) REFERENCES `coefficient_tables`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipment_categories_name_unique` ON `equipment_categories` (`name`);--> statement-breakpoint
CREATE TABLE `inspection_cycles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`interval_months` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inspection_cycles_name_unique` ON `inspection_cycles` (`name`);--> statement-breakpoint
CREATE TABLE `inspection_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`type` text NOT NULL,
	`is_done` integer DEFAULT 0 NOT NULL,
	`done_date` text,
	`note` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inspection_records_customer_id_year_month_type_unique` ON `inspection_records` (`customer_id`,`year`,`month`,`type`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`base_address` text DEFAULT '' NOT NULL,
	`base_lat` real,
	`base_lng` real,
	`google_maps_api_key` text,
	`tax_rate` real DEFAULT 0.1 NOT NULL,
	`distance_mode` text DEFAULT 'auto' NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
