import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionEntity } from '../../entities/permission.entity';
import { RolePermissionEntity } from '../../entities/role-permission.entity';

export interface PermissionsWithCategories {
  data: PermissionEntity[];
  categories: string[];
}

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly permissionRepository: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermissionRepository: Repository<RolePermissionEntity>,
  ) {}

  async findAll(): Promise<PermissionsWithCategories> {
    const permissions = await this.permissionRepository.find({
      order: { category: 'ASC', code: 'ASC' },
    });

    const categories = [...new Set(permissions.map((p) => p.category))].sort();

    return {
      data: permissions,
      categories,
    };
  }

  async findByRole(role: string): Promise<string[]> {
    const rolePermissions = await this.rolePermissionRepository.find({
      where: { role },
      select: ['permissionCode'],
      order: { permissionCode: 'ASC' },
    });

    return rolePermissions.map((rp) => rp.permissionCode);
  }
}
