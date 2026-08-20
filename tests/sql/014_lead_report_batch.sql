-- Proof for CC-B16 "selesai kalau": posting 3 blocks twice with the same
-- idempotency_key yields 3 rows (not 6), and one invalid block fails the
-- whole batch (nothing saved).

begin;

insert into brands (name, slug) values ('Labbaika Group', 'labbaika-batch-test');

do $$
declare
  v_brand uuid; v_cs uuid; v_s1 uuid; v_s2 uuid; v_s3 uuid;
  v_blocks jsonb; v_n int;
begin
  select id into v_brand from brands where slug = 'labbaika-batch-test';
  insert into auth.users (id) values (gen_random_uuid()) returning id into v_cs;
  insert into app_users (id, brand_id, full_name, role) values (v_cs, v_brand, 'Reza', 'cs');

  insert into lead_sources (brand_id, name, slug) values (v_brand, 'Facebook CTWA', 'fb-ctwa') returning id into v_s1;
  insert into lead_sources (brand_id, name, slug) values (v_brand, 'Facebook LP', 'fb-lp') returning id into v_s2;
  insert into lead_sources (brand_id, name, slug) values (v_brand, 'Organic', 'organic') returning id into v_s3;

  v_blocks := jsonb_build_array(
    jsonb_build_object('source_id', v_s1, 'total_lead', 32, 'cold', 17, 'consultation', 9, 'offering', 6),
    jsonb_build_object('source_id', v_s2, 'total_lead', 14, 'cold', 8, 'consultation', 4, 'offering', 2),
    jsonb_build_object('source_id', v_s3, 'total_lead', 4, 'cold', 0, 'consultation', 2, 'offering', 2)
  );

  perform create_lead_report_batch(v_brand, v_cs, '2026-08-19', v_blocks, 'req-abc-123');
  perform create_lead_report_batch(v_brand, v_cs, '2026-08-19', v_blocks, 'req-abc-123'); -- retry, same key

  select count(*) into v_n from lead_reports where brand_id = v_brand and cs_id = v_cs;
  if v_n <> 3 then
    raise exception 'TEST 1 FAILED: expected 3 rows after retry, got %', v_n;
  end if;
  raise notice 'TEST 1 PASSED: 3 blocks posted twice with same idempotency_key -> 3 rows, not 6';

  -- Batch with one invalid block (sum mismatch) must save nothing new.
  declare
    v_bad_blocks jsonb := jsonb_build_array(
      jsonb_build_object('source_id', v_s1, 'total_lead', 99, 'cold', 1, 'consultation', 1, 'offering', 1), -- valid on its own but different date
      jsonb_build_object('source_id', v_s2, 'total_lead', 99, 'cold', 1, 'consultation', 1, 'offering', 1000) -- sum mismatch: invalid
    );
  begin
    begin
      perform create_lead_report_batch(v_brand, v_cs, '2026-08-20', v_bad_blocks, 'req-bad-1');
      raise exception 'TEST 2 FAILED: batch with invalid block was accepted';
    exception
      when check_violation then
        select count(*) into v_n from lead_reports where brand_id = v_brand and report_date = '2026-08-20';
        if v_n <> 0 then
          raise exception 'TEST 2 FAILED: partial rows leaked despite rejected batch, got %', v_n;
        end if;
        raise notice 'TEST 2 PASSED: batch with one invalid block saved zero rows (all-or-nothing)';
    end;
  end;
end $$;

rollback;
