-- Assertion helpers. Each assertion prints one line: PASS <name> | FAIL <name> (details)
create schema if not exists e2e;
grant usage on schema e2e to public;

create or replace function e2e.ok(name text, cond boolean) returns text language sql as
$$ select case when cond is true then 'PASS ' || name else 'FAIL ' || name || ' (condition was ' || coalesce(cond::text, 'null') || ')' end $$;

create or replace function e2e.eq(name text, actual anyelement, expected anyelement) returns text language sql as
$$ select case when actual is not distinct from expected then 'PASS ' || name
       else 'FAIL ' || name || ' (got ' || coalesce(actual::text, 'NULL') || ', expected ' || coalesce(expected::text, 'NULL') || ')' end $$;

-- scalar count of a query
create or replace function e2e.cnt(q text) returns bigint language plpgsql as
$$ declare n bigint; begin execute 'select count(*) from (' || q || ') s' into n; return n; end $$;

-- rows affected by a DML statement
create or replace function e2e.dml(q text) returns bigint language plpgsql as
$$ declare n bigint; begin execute q; get diagnostics n = row_count; return n; end $$;

-- expects the statement to raise (optionally with a specific SQLSTATE)
create or replace function e2e.raises(name text, q text, state text default null) returns text language plpgsql as
$$ begin
  begin
    execute q;
  exception when others then
    if state is null or sqlstate = state then return 'PASS ' || name; end if;
    return 'FAIL ' || name || ' (raised ' || sqlstate || ': ' || sqlerrm || ', expected ' || state || ')';
  end;
  return 'FAIL ' || name || ' (no error raised' || coalesce(', expected ' || state, '') || ')';
end $$;

-- expects the statement to succeed
create or replace function e2e.passes(name text, q text) returns text language plpgsql as
$$ begin
  begin
    execute q;
  exception when others then
    return 'FAIL ' || name || ' (raised ' || sqlstate || ': ' || sqlerrm || ')';
  end;
  return 'PASS ' || name;
end $$;

-- impersonate a PostgREST caller (role + jwt claims); call `reset role;` before switching again
create or replace function e2e.as_user(r text, sub uuid default null) returns void language plpgsql as
$$ begin
  perform set_config('request.jwt.claim.sub', coalesce(sub::text, ''), false);
  perform set_config('request.jwt.claim.role', r, false);
  perform set_config('role', r, false);
end $$;
