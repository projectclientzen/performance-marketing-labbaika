-- Proof for CC-B08 "selesai kalau": >= 12 valid format variants normalize
-- correctly, and invalid inputs are rejected. Cases mirror lib/utils/phone-id
-- (DS-07) — keep both lists identical.

do $$
declare
  case_input text;
  case_expected text;
  actual text;
  fail_count int := 0;
  valid_cases text[][] := array[
    ['08123456789', '+628123456789'],
    ['8123456789', '+628123456789'],
    ['628123456789', '+628123456789'],
    ['+62 812-3456-789', '+628123456789'],
    ['+62812 3456 789', '+628123456789'],
    ['0812-3456-789', '+628123456789'],
    ['+6281234567890', '+6281234567890'],
    ['0812 3456 789', '+628123456789'],
    ['(0812) 3456789', '+628123456789'],
    ['  628123456789  ', '+628123456789'],
    ['+62 8123456789', '+628123456789'],
    ['081234567890', '+6281234567890']
  ];
  invalid_cases text[] := array[
    '021555000',
    '+60123456789',
    '',
    '08 12 34',
    '08123abc789'
  ];
begin
  for i in 1 .. array_length(valid_cases, 1) loop
    case_input := valid_cases[i][1];
    case_expected := valid_cases[i][2];
    actual := normalize_wa_id(case_input);
    if actual is distinct from case_expected then
      raise notice 'FAIL valid case: input=% expected=% got=%', case_input, case_expected, actual;
      fail_count := fail_count + 1;
    end if;
  end loop;

  for i in 1 .. array_length(invalid_cases, 1) loop
    case_input := invalid_cases[i];
    actual := normalize_wa_id(case_input);
    if actual is not null then
      raise notice 'FAIL invalid case accepted: input=% got=%', case_input, actual;
      fail_count := fail_count + 1;
    end if;
  end loop;

  if fail_count > 0 then
    raise exception 'TEST FAILED: % case(s) mismatched', fail_count;
  end if;

  raise notice 'TEST PASSED: % valid variants normalized correctly, % invalid variants rejected',
    array_length(valid_cases, 1), array_length(invalid_cases, 1);
end $$;
