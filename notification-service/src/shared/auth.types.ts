export type AuthContextUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  userType: string;
  roles?: unknown;
};
