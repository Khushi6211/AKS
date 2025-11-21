# SendGrid Email Spam Prevention Guide

**For:** Ashish Ji - Arun Karyana Store  
**Date:** November 21, 2025  
**Purpose:** Configure SendGrid to prevent emails from going to spam folder

---

## Problem Overview

Currently, emails from Arun Karyana Store are going to spam folders because:
1. **Missing Domain Authentication**: SendGrid needs to verify you own the domain
2. **No SPF/DKIM/DMARC Records**: Email authentication protocols not configured
3. **Sender Reputation**: New SendGrid account needs to build trust with email providers

---

## Solution: SendGrid Domain Authentication

### Step 1: Access SendGrid Dashboard

1. Go to [SendGrid Dashboard](https://app.sendgrid.com)
2. Login with your SendGrid account credentials
3. Navigate to **Settings** > **Sender Authentication**

### Step 2: Authenticate Your Domain

#### Option A: If You Have a Custom Domain (Recommended)

**Example Domain:** `arunkaryana.com` or your business domain

1. Click **"Authenticate Your Domain"** button
2. Select your DNS host provider (e.g., GoDaddy, Namecheap, Cloudflare, etc.)
3. Enter your domain name: `yourdomain.com`
4. Choose **"Yes, use automated security"** (enables DKIM, SPF, DMARC)
5. Click **"Next"**

**SendGrid will provide DNS records to add:**

You'll see something like this:

```
DNS Records to Add:
====================

CNAME Records:
--------------
Host: s1._domainkey.yourdomain.com
Value: s1.domainkey.u12345678.wl.sendgrid.net

Host: s2._domainkey.yourdomain.com  
Value: s2.domainkey.u12345678.wl.sendgrid.net

Host: em1234.yourdomain.com
Value: u12345678.wl.sendgrid.net

TXT Record:
-----------
Host: @
Value: v=spf1 include:sendgrid.net ~all

DMARC Record (Optional but Recommended):
-----------------------------------------
Host: _dmarc.yourdomain.com
Value: v=DMARC1; p=none; rua=mailto:your-email@yourdomain.com
```

#### Option B: If Using Gmail/Free Email (Quick Fix)

If you don't have a custom domain yet, you can:
1. Use **Single Sender Verification** instead
2. Go to **Settings** > **Sender Authentication** > **Single Sender Verification**
3. Add your email address (e.g., `arunkaryana@gmail.com`)
4. Verify the email by clicking the link sent to your inbox
5. Update `SENDER_EMAIL` in environment variables on Render

**Note:** Single Sender Verification is less reliable than domain authentication.

### Step 3: Add DNS Records to Your Domain Provider

#### For GoDaddy:
1. Login to [GoDaddy](https://www.godaddy.com)
2. Go to **My Products** > **DNS**
3. Click **"Add"** for each record
4. Type: Select `CNAME` or `TXT` as specified
5. Host: Enter the host value from SendGrid
6. Points to: Enter the value from SendGrid
7. TTL: Keep as default (1 hour)
8. Save all records

#### For Namecheap:
1. Login to [Namecheap](https://www.namecheap.com)
2. Go to **Domain List** > Click **Manage**
3. Navigate to **Advanced DNS** tab
4. Click **Add New Record**
5. Add each CNAME and TXT record as specified
6. Save changes

#### For Cloudflare:
1. Login to [Cloudflare](https://www.cloudflare.com)
2. Select your domain
3. Go to **DNS** tab
4. Click **Add record**
5. Add each CNAME and TXT record
6. **Important:** Turn OFF orange cloud (set to DNS Only)
7. Save records

#### For Other Providers:
Search for "[Your Provider Name] add CNAME record" and "[Your Provider Name] add TXT record"

### Step 4: Verify Domain in SendGrid

1. Wait 24-48 hours for DNS propagation (sometimes it's faster - 1-2 hours)
2. Return to SendGrid **Sender Authentication** page
3. Click **"Verify"** button next to your domain
4. If successful, you'll see ✅ green checkmark
5. If failed, double-check DNS records and wait longer

You can check DNS propagation status at:
- [DNSChecker.org](https://dnschecker.org)
- [MXToolbox](https://mxtoolbox.com/SuperTool.aspx)

---

## Step 5: Update Sender Email in Your Application

### Update Environment Variables on Render.com:

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Select your backend service (Flask app)
3. Go to **Environment** tab
4. Update `SENDER_EMAIL` to match your authenticated domain:
   - If using domain authentication: `noreply@yourdomain.com` or `orders@yourdomain.com`
   - If using single sender: your verified email address
5. Click **"Save Changes"**
6. Render will automatically redeploy with new settings

**Current Configuration in Code:**
```python
# In main.py, emails are sent using:
sender_email = os.getenv('SENDER_EMAIL', 'default-sender@yourdomain.com')
```

---

## Additional Spam Prevention Best Practices

### 1. Build Sender Reputation (Email Warm-up)

**First Week:**
- Send 10-20 emails per day
- Only to engaged recipients who will open/click

**Week 2-4:**
- Gradually increase to 50-100 emails per day
- Monitor spam rates in SendGrid dashboard

**Month 2+:**
- Can send up to SendGrid plan limit (100/day on free tier)

### 2. Improve Email Content

**Good Practices:**
- ✅ Include company name and address (already done in your templates!)
- ✅ Add unsubscribe link for marketing emails
- ✅ Use proper HTML structure (already implemented)
- ✅ Include text version alongside HTML
- ✅ Avoid spam trigger words: "FREE!!!", "URGENT", "ACT NOW"

**Your Current Implementation:**
All emails now include:
- Company logo ✅
- Company name and address ✅
- Professional HTML structure ✅
- Proper branding ✅

### 3. Monitor Email Metrics in SendGrid

Check regularly:
- **Delivered Rate**: Should be >95%
- **Open Rate**: Healthy is 15-25% for transactional emails
- **Bounce Rate**: Should be <5%
- **Spam Report Rate**: Should be <0.1%

Access at: **SendGrid Dashboard** > **Activity** > **Email Activity**

### 4. Set Up DMARC Reporting

Add DMARC TXT record to your DNS:
```
Host: _dmarc.yourdomain.com
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@yourdomain.com; pct=100
```

This tells email providers what to do with unauthenticated emails:
- `p=none`: Monitor only (start with this)
- `p=quarantine`: Send to spam if failed
- `p=reject`: Block completely if failed

---

## Testing Email Deliverability

### After DNS Configuration:

1. **Test with Mail-Tester:**
   - Visit [Mail-Tester.com](https://www.mail-tester.com)
   - They'll give you a test email address
   - Trigger a password reset or test order to that address
   - Check your score (aim for 8/10 or higher)

2. **Test with Multiple Email Providers:**
   - Gmail account
   - Outlook/Hotmail account
   - Yahoo account
   - Check if emails land in Inbox or Spam

3. **Use SendGrid Email Testing Tool:**
   - SendGrid Dashboard > **Email Testing**
   - Send test emails to verify delivery

---

## Troubleshooting Common Issues

### Issue 1: DNS Records Not Verifying
**Solution:**
- Wait 48 hours for full propagation
- Use [DNSChecker.org](https://dnschecker.org) to verify records globally
- Ensure no typos in DNS records
- Check that CNAME records don't have trailing dots (depends on provider)

### Issue 2: Emails Still Going to Spam After Configuration
**Solution:**
- Verify domain authentication shows ✅ in SendGrid
- Check sender reputation isn't damaged (new accounts take time)
- Ensure `SENDER_EMAIL` on Render matches authenticated domain
- Implement email warm-up strategy (gradual increase)
- Ask recipients to mark as "Not Spam" and add to contacts

### Issue 3: "Authentication Failed" Errors
**Solution:**
- Verify `SENDGRID_API_KEY` in Render environment variables
- Check API key has "Mail Send" permissions in SendGrid
- Ensure API key hasn't expired

### Issue 4: Emails Not Sending at All
**Solution:**
- Check SendGrid API key is valid
- Check you haven't exceeded daily limit (100 on free tier)
- Check SendGrid account status (not suspended)
- Review error logs on Render dashboard

---

## Quick Start Checklist

Use this checklist to configure SendGrid properly:

- [ ] Login to SendGrid Dashboard
- [ ] Navigate to Settings > Sender Authentication
- [ ] Choose Domain Authentication or Single Sender Verification
- [ ] Copy DNS records provided by SendGrid
- [ ] Login to your domain DNS provider (GoDaddy, Namecheap, etc.)
- [ ] Add all CNAME and TXT records to DNS
- [ ] Wait 24-48 hours for DNS propagation
- [ ] Verify domain in SendGrid (should show green checkmark)
- [ ] Update `SENDER_EMAIL` on Render to match authenticated domain
- [ ] Test email delivery to Gmail, Outlook, Yahoo
- [ ] Check spam score using Mail-Tester.com
- [ ] Monitor email metrics in SendGrid dashboard
- [ ] Implement gradual email warm-up (10-20/day initially)

---

## Cost Considerations

### SendGrid Free Tier:
- ✅ 100 emails per day (sufficient for small store)
- ✅ Full domain authentication features
- ✅ Email activity tracking
- ✅ API access

### If You Need More:
**SendGrid Essentials Plan** ($19.95/month):
- 50,000 emails per month
- Better deliverability tools
- Support tickets

**Alternative Free Options:**
- Mailgun: 5,000 emails/month free
- Amazon SES: $0.10 per 1,000 emails (requires AWS account)

---

## Getting Help

### SendGrid Support Resources:
- [SendGrid Documentation](https://docs.sendgrid.com)
- [Domain Authentication Guide](https://docs.sendgrid.com/ui/account-and-settings/how-to-set-up-domain-authentication)
- [SendGrid Support](https://support.sendgrid.com) (for paid plans)
- [SendGrid Community Forum](https://community.sendgrid.com)

### DNS Provider Support:
- GoDaddy: [support.godaddy.com](https://support.godaddy.com)
- Namecheap: [namecheap.com/support](https://www.namecheap.com/support/)
- Cloudflare: [support.cloudflare.com](https://support.cloudflare.com)

---

## Summary

**What Was Fixed in Code (Already Done):**
- ✅ Email templates now match website brown/gold theme
- ✅ Company logo added to all emails
- ✅ Proper fonts and styling applied
- ✅ Professional email structure

**What You Need to Configure (DNS/SendGrid):**
- ⏳ Domain authentication in SendGrid
- ⏳ DNS records (SPF, DKIM, DMARC)
- ⏳ Update SENDER_EMAIL on Render
- ⏳ Email warm-up strategy

**Expected Timeline:**
- DNS configuration: 30 minutes
- DNS propagation wait: 24-48 hours  
- Domain verification: 5 minutes
- Email warm-up: 2-4 weeks for best reputation

**Result After Configuration:**
- 📧 Emails will land in Inbox instead of Spam
- ✅ Professional sender authentication
- 📈 Better email deliverability rates
- 🎯 Trusted sender reputation

---

**Need Help?** Contact me if you have questions about any of these steps!

Best regards,  
Your Development Team
