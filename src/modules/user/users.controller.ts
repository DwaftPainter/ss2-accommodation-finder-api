import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/jwt.guard';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import type { AuthenticatedRequest } from '../../common/types';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private service: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@Req() req: AuthenticatedRequest) {
    return this.service.getMe(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateMe(
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateUserDto,
  ) {
    return this.service.updateMe(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  @ApiOperation({ summary: 'Search users with OpenSearch (fallback to DB)' })
  async searchUsers(
    @Query('q') query: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('emailVerified') emailVerified?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    const filters: any = {};
    if (role) filters.role = role;
    if (status) filters.status = status;
    if (emailVerified !== undefined)
      filters.emailVerified = emailVerified === 'true';

    return this.service.searchUsers(
      query,
      filters,
      page ?? 1,
      limit ?? 20,
    );
  }
}
