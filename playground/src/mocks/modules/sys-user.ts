import { faker } from "@faker-js/faker";

import { createCrudMock } from "../helpers/crud";

interface UserRow {
  id: string;
  staffId?: string | null;
  username: string;
  password: string;
  name: string;
  isActive: boolean;
  isLocked: boolean;
  passwordUpdatedAt?: string | null;
  avatar?: string | null;
  gender: string;
  phoneNumber?: string | null;
  email?: string | null;
  remark?: string | null;
  roleIds?: string[];
  roleNames?: string[];
}

createCrudMock<UserRow>({
  resource: "sys/user",
  seed: 28,
  searchFields: ["username", "name", "email", "phoneNumber"],
  labelField: "name",
  factory: i => {
    return {
      id: faker.string.uuid(),
      staffId: null,
      username: faker.internet.username().toLowerCase(),
      password: "******",
      name: faker.person.fullName(),
      isActive: i % 7 !== 0,
      isLocked: i % 11 === 0,
      passwordUpdatedAt: faker.date.recent({ days: 90 }).toISOString(),
      avatar: null,
      gender: i % 2 === 0 ? "male" : "female",
      phoneNumber: faker.phone.number(),
      email: faker.internet.email(),
      remark: null,
      roleIds: [],
      roleNames: []
    };
  }
});
