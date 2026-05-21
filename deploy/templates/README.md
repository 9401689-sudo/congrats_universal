# Templates Directory

Put renderer templates and related assets here before production deployment.

Expected in-container mount:

- host path: `deploy/templates`
- container path: `/mnt/razresheno`

Current `.env` expectation:

- `PYTHON_RENDERER_TEMPLATES_DIR=/mnt/razresheno/templates`

That means the effective on-disk structure should usually look like:

```text
deploy/templates/
  templates/
    ...
  seal/
    ...
  stamp/
    ...
  fonts/
    ...
  backgrounds/
    ...
```

This directory is intentionally just a placeholder in git.
Do not commit private or licensed assets unless you are sure they may live in the repository.
