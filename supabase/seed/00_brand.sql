-- DS-01/02/03 prerequisite: lead_sources and insight_categories both have
-- brand_id NOT NULL (multi-brand ready schema, 04-BRIEF-BE.md §2.1), so a
-- brand row must exist before those seeds can insert anything. Idempotent.
insert into brands (name, slug) values ('Labbaika Group', 'labbaika')
on conflict (slug) do nothing;
