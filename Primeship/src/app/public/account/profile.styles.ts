export const PROFILE_STYLES = `
:host {
  display: block;
}

.account-container {
  --surface: #ffffff;
  --surface-soft: #f8fafc;
  --line: #dfe6ee;
  --line-strong: #d3dbe4;
  --text: #141b2d;
  --muted: #66768a;
  --accent: #16a34a;
  --accent-soft: #e8f8ed;
  --accent-strong: #15803d;
  --shadow: 0 24px 54px rgba(15, 23, 42, 0.12);
  --shadow-soft: 0 16px 28px rgba(15, 23, 42, 0.06);

  min-height: 100vh;
  padding: 2.2rem 0 3rem;
  background:
    radial-gradient(circle at top left, rgba(22, 163, 74, 0.14) 0%, transparent 24%),
    linear-gradient(180deg, #d5d9e0 0%, #ecf5ef 100%);
}

.account-shell {
  display: grid;
  grid-template-columns: 218px minmax(0, 1fr);
  overflow: hidden;
  border-radius: 30px;
  border: 1px solid rgba(226, 231, 238, 0.95);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.account-sidebar {
  padding: 1.05rem 0.95rem 1rem;
  border-right: 1px solid var(--line);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
}

.brand-mark-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.4rem 0.95rem;
  margin-bottom: 0.9rem;
  border-bottom: 1px solid rgba(223, 230, 238, 0.8);
}

.brand-mark {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  transform: rotate(45deg);
  box-shadow: 0 6px 14px rgba(22, 163, 74, 0.22);
}

.brand-bar {
  width: 58px;
  height: 12px;
  border-radius: 999px;
  background: linear-gradient(180deg, #dadde3 0%, #cbd2da 100%);
}

.sidebar-user {
  display: grid;
  justify-items: center;
  gap: 0.35rem;
  padding: 0.15rem 0 1rem;
  margin-bottom: 0.9rem;
  border-bottom: 1px solid var(--line);
  text-align: center;
}

.sidebar-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  padding: 3px;
  background: linear-gradient(180deg, #ffffff 0%, #eef3f8 100%);
  box-shadow: 0 10px 18px rgba(15, 23, 42, 0.12);
}

.sidebar-avatar img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.sidebar-user h5 {
  margin: 0.15rem 0 0;
  color: var(--text);
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.sidebar-user .user-email {
  margin: 0;
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.35;
  word-break: break-word;
}

.account-nav {
  display: grid;
  gap: 0.24rem;
  padding: 0 0.1rem;
}

.account-nav .nav-link {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 34px;
  padding: 0.5rem 0.7rem;
  border-radius: 8px;
  color: #4f5d70;
  font-size: 0.82rem;
  font-weight: 500;
  text-decoration: none;
  transition:
    background 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease,
    box-shadow 0.16s ease;
}

.account-nav .nav-link i {
  width: 17px;
  text-align: center;
  color: #6d7b8d;
  font-size: 0.92rem;
}

.account-nav .nav-link:hover {
  background: #f4f7fb;
  color: var(--text);
  transform: translateX(1px);
}

.account-nav .nav-link.active {
  background: var(--accent-soft);
  color: var(--accent);
}

.account-nav .nav-link.active i {
  color: var(--accent);
}

.sidebar-note {
  position: relative;
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 0.65rem;
  align-items: start;
  margin-top: 1rem;
  padding: 0.85rem 2rem 0.85rem 0.8rem;
  border-radius: 10px;
  border: 1px solid rgba(22, 163, 74, 0.18);
  background: #f4fbf6;
  color: #166534;
}

.sidebar-note-icon {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(22, 163, 74, 0.12);
  color: #16a34a;
  font-size: 0.88rem;
}

.sidebar-note-copy strong {
  display: block;
  font-size: 0.82rem;
  line-height: 1.35;
  font-weight: 700;
}

.sidebar-note-copy p {
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
  line-height: 1.3;
}

.sidebar-note-copy a {
  color: #15803d;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.sidebar-note-close {
  position: absolute;
  top: 0.45rem;
  right: 0.45rem;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #15803d;
  cursor: pointer;
}

.sidebar-note-close:hover {
  background: rgba(22, 163, 74, 0.1);
}

.account-content {
  padding: 1rem 1.2rem 1.25rem;
  background: #fff;
}

.content-breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.35rem;
  color: #8a94a6;
  font-size: 0.72rem;
}

.content-breadcrumb strong {
  color: #4f6f56;
  font-weight: 600;
}

.content-breadcrumb i {
  font-size: 0.58rem;
}

.page-title {
  margin: 0 0 0.7rem;
  color: var(--text);
  font-size: 1.18rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.profile-intro {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding-bottom: 0.7rem;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid var(--line);
}

.profile-avatar-large {
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border-radius: 50%;
  padding: 2px;
  background: linear-gradient(180deg, #ffffff 0%, #eef3f8 100%);
  box-shadow: 0 8px 14px rgba(15, 23, 42, 0.1);
}

.profile-avatar-large img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.profile-intro-copy h2 {
  margin: 0;
  color: var(--text);
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.display-image-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: #15803d;
  font-size: 0.74rem;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.profile-form {
  display: grid;
  gap: 1rem;
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.4rem;
}

.profile-column {
  display: grid;
  gap: 0.75rem;
  align-content: start;
}

.form-group,
.field-group {
  display: grid;
  gap: 0.3rem;
}

.form-group label,
.field-group label,
.methods-header label {
  color: #2f3643;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0;
}

.form-control {
  width: 100%;
  min-height: 30px;
  padding: 0.45rem 0.72rem;
  border-radius: 6px;
  border: 1px solid #d5dce5;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  color: var(--text);
  font: inherit;
  font-size: 0.76rem;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

.form-control:focus {
  outline: none;
  border-color: rgba(22, 163, 74, 0.6);
  box-shadow: 0 0 0 0.16rem rgba(22, 163, 74, 0.08);
  transform: translateY(-1px);
}

.form-control::placeholder {
  color: #98a4b2;
}

.dob-row {
  display: grid;
  grid-template-columns: 42px 42px minmax(0, 1fr);
  gap: 0.45rem;
}

.dob-input {
  text-align: center;
}

.dob-year {
  text-align: left;
}

.methods-panel {
  display: grid;
  gap: 0.55rem;
  padding-top: 0.15rem;
}

.methods-header {
  display: flex;
  align-items: center;
}

.method-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.64rem 0.74rem;
  border-radius: 6px;
  border: 1px solid #d8dee8;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
}

.method-copy {
  min-width: 0;
}

.method-title {
  color: var(--text);
  font-size: 0.72rem;
  font-weight: 700;
}

.method-subtitle,
.method-reference {
  color: #606d7d;
  font-size: 0.66rem;
  line-height: 1.25;
}

.method-reference {
  margin-top: 0.1rem;
}

.method-edit-btn {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  border: 1px solid #cdd7e3;
  border-radius: 4px;
  background: #ffffff;
  color: #5f6b78;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;
}

.method-edit-btn:hover {
  background: #f4f7fb;
  border-color: #b8c4d3;
  color: var(--text);
  transform: translateY(-1px);
}

.add-method-btn {
  justify-self: center;
  margin-top: 0.2rem;
  min-height: 2.35rem;
  padding: 0.55rem 1.05rem;
  border: 0;
  border-radius: 8px;
  background: #e8f8ed;
  color: var(--accent-strong);
  font-size: 0.86rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition:
    background 0.16s ease,
    transform 0.16s ease;
}

.add-method-btn:hover {
  background: #d6f3df;
  transform: translateY(-1px);
}

.input-shell {
  position: relative;
}

.input-shell .form-control {
  padding-right: 2rem;
}

.input-icon {
  position: absolute;
  top: 50%;
  right: 0.6rem;
  transform: translateY(-50%);
  color: #6c7786;
  font-size: 0.84rem;
  pointer-events: none;
}

.field-error {
  color: #c2410c;
  font-size: 0.68rem;
  font-weight: 600;
}

.form-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.7rem;
  padding-top: 0.15rem;
}

.cancel-btn,
.save-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 0.4rem 0.85rem;
  border: 1px solid transparent;
  border-radius: 6px;
  font: inherit;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease,
    background 0.16s ease,
    color 0.16s ease,
    border-color 0.16s ease;
}

.cancel-btn {
  background: transparent;
  color: #4f5d70;
}

.cancel-btn:hover {
  background: #f4f7fb;
  color: var(--text);
  transform: translateY(-1px);
}

.save-btn {
  background: linear-gradient(135deg, var(--accent) 0%, #0f8a42 100%);
  color: #fff;
  box-shadow: 0 10px 18px rgba(22, 163, 74, 0.16);
}

.save-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #22c55e 0%, #13803c 100%);
  transform: translateY(-1px);
}

.save-btn:disabled {
  opacity: 0.68;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

@media (max-width: 991px) {
  .account-shell {
    grid-template-columns: 1fr;
  }

  .account-sidebar {
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .account-content {
    padding: 1rem;
  }

  .profile-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}

@media (max-width: 767px) {
  .account-container {
    padding: 1rem 0 2rem;
  }

  .account-shell {
    border-radius: 22px;
  }

  .account-sidebar {
    padding: 0.9rem 0.8rem 0.85rem;
  }

  .account-content {
    padding: 0.9rem 0.85rem 1rem;
  }

  .sidebar-avatar {
    width: 64px;
    height: 64px;
  }

  .sidebar-note {
    grid-template-columns: 22px minmax(0, 1fr);
  }

  .profile-intro {
    align-items: flex-start;
  }

  .profile-avatar-large {
    width: 36px;
    height: 36px;
  }

  .dob-row {
    grid-template-columns: 38px 38px minmax(0, 1fr);
  }

  .form-footer {
    justify-content: stretch;
    flex-direction: column;
  }

  .cancel-btn,
  .save-btn {
    width: 100%;
  }
}
`;
