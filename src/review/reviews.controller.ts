import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { ReviewsService } from './reviews.service';
import { UpdateReviewDto } from './dto/update-review.dto';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private service: ReviewsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req, @Body() body: CreateReviewDto) {
    return this.service.create(req.user.userId, body);
  }

  @Get('listing/:listingId')
  getByListing(@Param('listingId') listingId: string) {
    return this.service.getByListing(listingId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() body: UpdateReviewDto) {
    return this.service.update(req.user.userId, id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  delete(@Req() req, @Param('id') id: string) {
    return this.service.delete(req.user.userId, id);
  }
}
