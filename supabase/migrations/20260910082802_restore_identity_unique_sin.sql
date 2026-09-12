alter table limbus.identities add column sin_affinity text
check (sin_affinity in ('wrath','lust','sloth','gluttony','gloom','pride','envy'));
comment on column limbus.identities.sin_affinity is
'Game personality.uniqueAttribute; independent from individual skill affinities and inferred keyword themes';
