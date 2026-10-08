import re

with open('admin.html', 'r', encoding='utf-8') as f:
    html = f.read()

# We will just checkout the original admin.html from the initial commit f263785 to start clean!
