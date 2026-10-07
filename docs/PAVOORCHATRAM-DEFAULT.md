# Pavoorchatram default and duplicate cleanup

Login and a fresh page load now prefer the accessible branch with code `PCM`.
Older local databases without PCM fall back to the accessible Pavoorchatram name.
Manual branch switching remains available during the session. Staff without PCM
access retain their own accessible branch. Existing sessions on an inactive branch
can recover using the branch list before loading inventory or invoices.

Deploy the updated frontend and backend together. No schema migration is needed.

## Empty duplicate

The duplicate is `PAV` (`cmu7lp2da0001w478ry6fra25`). Keep `PCM`
(`cmti1m17y0001w4zwwin3hmr8`), which contains the shop's stock and bills.
Deployment alone does not deactivate PAV. Take a production database backup,
then run the following from the project folder with the intended server's
`DATABASE_URL` configured:

```sh
node scripts/retire-empty-pav.mjs
node scripts/retire-empty-pav.mjs --apply
```

The first command only checks. The second repeats all checks transactionally,
then sets only the duplicate branch's `active` flag to false and writes an audit
event. It refuses if business records, queued operations, or active non-owner
staff assignments exist. It never deletes or transfers stock, invoices, or users.
If the specified branch IDs do not exist locally, the script stops without changes.

For Docker deployments, run the script inside the app container so it uses the
server database. The Dockerfile includes the script in the updated image:

```sh
docker exec happybonding_app node scripts/retire-empty-pav.mjs
docker exec happybonding_app node scripts/retire-empty-pav.mjs --apply
```

Verify owner login opens PCM; switching to AMBAI works; reloading opens PCM;
AMBAI-only staff remain in AMBAI. After cleanup, the branch list should contain
one active Pavoorchatram branch. Verify PCM stock and saved invoices remain intact.
