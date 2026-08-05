import glob, re

html_files = glob.glob('*.html')
print(f"Updating {len(html_files)} HTML files with Montserrat font...")

for path in html_files:
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    # Check if Montserrat is already in the file
    if 'Montserrat' in content:
        print(f"  {path}: already has Montserrat")
        continue

    # Look for fonts.googleapis.com link
    if 'fonts.googleapis.com' in content:
        # Replace existing fonts link or insert Montserrat
        # We can replace 'family=Inter' with 'family=Montserrat:wght@300;400;500;600;700;800;900&family=Inter'
        new_content = re.sub(
            r'(href="https://fonts\.googleapis\.com/css2\?[^"]*)',
            r'\1&family=Montserrat:wght@300;400;500;600;700;800;900',
            content
        )
        if new_content == content:
            # Try single quotes
            new_content = re.sub(
                r"(href='https://fonts\.googleapis\.com/css2\?[^']*)",
                r"\1&family=Montserrat:wght@300;400;500;600;700;800;900",
                content
            )
        if new_content != content:
            content = new_content
            print(f"  {path}: updated existing Google Fonts link with Montserrat")
        else:
            print(f"  {path}: could not match font link pattern")
    else:
        # Insert Google Fonts link with Montserrat and Inter before </head>
        font_tag = '    <link rel="preconnect" href="https://fonts.googleapis.com" />\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />\n'
        if '</head>' in content:
            content = content.replace('</head>', font_tag + '</head>', 1)
            print(f"  {path}: inserted Montserrat font link")
        else:
            print(f"  {path}: no </head> found")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Finished updating HTML files.")
