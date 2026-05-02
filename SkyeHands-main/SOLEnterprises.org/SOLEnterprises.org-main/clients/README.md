# Client Sites Directory

This folder hosts individual client websites as "minisites" within the SOLEnterprises.org domain.

## Structure

```
clients/
├── index.html              # Client portfolio hub page
├── README.md              # This file
├── example-client/        # Example client site folder
│   ├── index.html         # Client's homepage
│   ├── assets/           # Client's assets (optional)
│   └── ...               # Other client pages
└── another-client/        # Another client site
    └── index.html
```

## Adding a New Client Site

### 1. Create Client Folder

```bash
mkdir /workspaces/SOLEnterprises.org/clients/CLIENT-NAME
```

Use lowercase with hyphens (e.g., `acme-corp`, `johns-bakery`)

### 2. Add Client's Website

Place their complete website inside the folder:

```bash
clients/CLIENT-NAME/
├── index.html          # Required: their homepage
├── about.html          # Optional: additional pages
├── contact.html
├── assets/            # Optional: their assets
│   ├── css/
│   ├── images/
│   └── js/
└── ...
```

### 3. Update Client Hub

Edit `/workspaces/SOLEnterprises.org/clients/index.html` and add a new client card:

```html
<a class="client-card" href="/clients/CLIENT-NAME/" target="_blank">
  <div class="client-logo">🏢</div>
  <h3 class="client-name">Client Business Name</h3>
  <p class="client-desc">Brief description of their business or website.</p>
  <div class="client-meta">
    <span class="client-tag">Industry</span>
    <span class="client-tag">Live</span>
  </div>
</a>
```

### 4. Access the Site

- **Client Hub**: `https://yourdomain.com/clients/`
- **Individual Client**: `https://yourdomain.com/clients/CLIENT-NAME/`

## Best Practices

### Isolation
- Each client should have their own self-contained folder
- Keep client assets separate from main site assets
- Use relative paths within client sites

### Naming
- Use descriptive, URL-friendly folder names
- Lowercase with hyphens: `my-business-name`
- Avoid spaces, special characters, uppercase

### Organization
```
clients/
├── active/           # Currently live client sites
├── staging/          # Sites in development
└── archive/          # Completed/inactive sites
```

### Security
- Don't include sensitive data in client folders
- Use .gitignore if needed for private client data
- Consider authentication for staging sites

## Firebase Hosting

If using Firebase, client sites are automatically hosted at:
```
https://solenterprises-58215.web.app/clients/CLIENT-NAME/
```

## Example Client Site Template

Minimal template for a new client:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Client Name | Hosted by SOLEnterprises</title>
  <style>
    body {
      margin: 0;
      font-family: system-ui, sans-serif;
      background: #0a0a0a;
      color: #ffffff;
      padding: 40px 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome to [Client Name]</h1>
    <p>This site is hosted by SOLEnterprises</p>
  </div>
</body>
</html>
```

## Maintenance

- Regularly review active client sites
- Archive completed projects
- Update client hub when adding/removing sites
- Test client sites after deployment

## Support

For questions about hosting client sites, contact the SOLEnterprises team.
