# Deploying

The primary way to release this repository is via Azure App Service deployment slots,
driven by pushing to the `prod` branch.

## Release flow

1. **Push to `prod`.** This triggers the GitHub Actions workflow
   [`prod_learn-mcp(staging).yml`](.github/workflows/prod_learn-mcp(staging).yml), which
   builds the app and deploys it to the **staging slot** of the `learn-mcp` Azure Web
   App (Azure subscription: **Kontent Learn**).
2. **Verify on staging:**

   ```
   https://learn-mcp-staging-a3bxawf3dhazacf0.westeurope-01.azurewebsites.net
   ```

3. **Promote to production.** Once staging looks good, swap the staging slot with the
   production slot in the [Azure Portal](https://portal.azure.com) (App Service →
   `learn-mcp` → Deployment slots → Swap). This step is manual — it is not part of the
   GitHub Actions workflow.
4. **Live at production:**

   ```
   https://learn-mcp-hzc6csg7b4cxb0hf.westeurope-01.azurewebsites.net
   ```

## Alternative: Docker / Azure Container Instances

For running the server as a standalone Docker container (e.g. on Azure Container
Instances) instead of the Azure Web App above, see
[`docker-info/docker-aci.md`](docker-info/docker-aci.md).
